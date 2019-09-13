/*
ISC License (ISC)

Copyright 2019 James Adam Armstrong

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above copyright
notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
*/

import vscode from 'vscode'
import {
	TestAdapter,
	TestLoadStartedEvent,
	TestLoadFinishedEvent,
	TestRunStartedEvent,
	TestRunFinishedEvent,
	TestSuiteEvent,
	TestEvent,
} from 'vscode-test-adapter-api'
import { Log } from 'vscode-test-adapter-util/out/log'
import is from '@sindresorhus/is'
import { AVAConfig, LoadedConfig, SubConfig } from './config'
import TestTree from './test_tree'
import { Worker } from './worker'
import { SerialQueue } from './queue'
import connectDebugger from './debugger'

/** Disposable interface. */
interface IDisposable {
	/** Dispose of the object. */
	dispose(): void
}

/** Events for test states. */
type TestStates = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
/** Test Start and Finish events. */
type TestEvents = TestLoadStartedEvent | TestLoadFinishedEvent

/** The test adapter. */
export class AVAAdapter implements TestAdapter, IDisposable {
	/** Array of objects to dispose of when dispose() is called. */
	private disposables: IDisposable[] = []
	/** Emits test events. */
	private readonly testsEmitter = new vscode.EventEmitter<TestEvents>()
	/** Emits test state events. */
	private readonly testStatesEmitter = new vscode.EventEmitter<TestStates>()
	/** Triggers auto test runs. */
	private readonly autorunEmitter = new vscode.EventEmitter<void>()
	/** The set of files to watch for changes. */
	private files = new Set<string>()
	/** Map of configuration IDs to SubConfigs. */
	private configMap = new Map<string, SubConfig>()
	/** The loaded settings. */
	private config: LoadedConfig | null = null
	/** The Worker, if there is one. */
	private worker?: Worker
	/** Queue actions. */
	private readonly queue = new SerialQueue()
	/** The VSCode Workspace. */
	public readonly workspace: vscode.WorkspaceFolder
	/** The VSCode output channel. */
	public readonly channel: vscode.OutputChannel
	/** The output Log. */
	private readonly log: Log
	/** Count of active test runs. */
	private running = 0

	/**
	 * @override
	 * @inheritdoc
	 */
	public get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
		return this.testsEmitter.event
	}

	/**
	 * @override
	 * @inheritdoc
	 */
	public get testStates(): vscode.Event<TestStates> {
		return this.testStatesEmitter.event
	}

	/**
	 * @override
	 * @inheritdoc
	 */
	public get autorun(): vscode.Event<void> | undefined {
		return this.autorunEmitter.event
	}

	/**
	 * Constructs the adapter and sets up the VSCode event handlers.
	 * @param workspace The VSCode Workspace.
	 * @param channel The VSCode output channel.
	 * @param log The output Log.
	 */
	public constructor(workspace: vscode.WorkspaceFolder, channel: vscode.OutputChannel, log: Log) {
		this.workspace = workspace
		this.channel = channel
		this.log = log
		this.log.info('Initializing AVA Adapter...')

		this.disposables.push(this.testsEmitter)
		this.disposables.push(this.testStatesEmitter)
		this.disposables.push(this.autorunEmitter)

		this.disposables.push(
			vscode.workspace.onDidChangeConfiguration(
				async (configChange): Promise<void> => {
					this.log.info('Configuration changed')
					const uri = this.workspace.uri
					if (
						AVAConfig.affected(uri, configChange, 'cwd', 'env', 'nodePath', 'nodeArgv')
					) {
						this.log.info('Sending reload event')
						await this.loadConfig(true)
						this.load()
						return
					} else if (AVAConfig.affected(uri, configChange, 'configs')) {
						this.log.info('Sending reload event')
						await this.loadConfig()
						this.load()
					} else if (
						AVAConfig.affected(uri, configChange, 'debuggerPort', 'debuggerSkipFiles')
					) {
						await this.loadConfig()
					}
					if (AVAConfig.affected(uri, configChange, 'logpanel', 'logfile')) {
						this.channel.appendLine('[Main] Logging settings changed.')
						this.queue.add((): void => {
							const w = this.worker
							if (w) {
								w.send({ type: 'log', enable: this.log.enabled })
							}
						})
					}
				}
			)
		)

		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument(
				async (document): Promise<void> => {
					if (!this.config) return
					const filename = document.uri.fsPath
					const workPath = this.workspace.uri.fsPath
					if (this.log.enabled) {
						this.log.info(
							`${filename} was saved - checking if this affects ${workPath}`
						)
					}
					const f = this.files
					if (f.has(filename)) {
						if (this.log.enabled) {
							this.log.info(`Sending reload event because ${filename} was saved.`)
						}
						this.load()
						return
					}
					if (filename.startsWith(workPath)) {
						if (this.log.enabled) {
							this.log.info('Sending autorun event')
						}
						this.autorunEmitter.fire()
					}
				}
			)
		)
	}

	/**
	 * @override
	 * @inheritdoc
	 */
	public async load(): Promise<void> {
		this.testsEmitter.fire({ type: 'started' })
		const config = this.config || (await this.loadConfig())
		if (!config) {
			this.log.error(`config unavailable to load tests.`)
			this.testsEmitter.fire({ type: 'finished', suite: undefined })
			this.files.clear()
			this.configMap = new Map<string, SubConfig>()
			return
		}
		if (this.log.enabled) {
			this.log.info(`Loading test files of ${this.workspace.uri.fsPath}`)
		}
		return this.queue.add(
			async (): Promise<void> => {
				const m = new Map<string, SubConfig>()
				const tree = new TestTree(this.log, config.cwd, (info): void => {
					info.tooltip = process.env.NODE_ENV === 'production' ? info.label : info.id
				})
				const w = this.worker
				if (w) {
					w.send({ type: 'drop' })
					const off: (() => void)[] = []
					w.on('prefix', tree.pushPrefix.bind(tree), off)
						.on('file', tree.pushFile.bind(tree), off)
						.on('case', tree.pushTest.bind(tree), off)
					const subs = config.configs
					for (const sub of subs) {
						await w
							.send({ type: 'load', file: sub.file })
							.then((): void => {
								if (this.log.enabled) {
									this.log.info(`Loaded test information for ${sub.file}`)
								}
							})
							.catch((error: Error): void => {
								this.log.error(error)
							})
					}
					for (const o of off) {
						o()
					}
					this.testsEmitter.fire({ type: 'finished', suite: tree.build() })
					for (const [file, id] of tree.getConfigs) {
						const sub = subs.find((x): boolean => x.file === file)
						if (sub) {
							m.set(id, sub)
						}
					}
				} else {
					this.log.error('No worker connected.')
					this.testsEmitter.fire({ type: 'finished', suite: tree.rootSuite })
				}
				this.files = tree.getFiles
				this.configMap = m
			}
		)
	}

	/**
	 * @param testsToRun Array of IDs to run tests for.
	 * @override
	 * @inheritdoc
	 */
	public async run(testsToRun: string[]): Promise<void> {
		const config = this.config
		if (!config) return
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Running test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		return this.queue.add((): void => {
			const w = this.worker
			if (w) {
				this.running += 1
				this.testStatesEmitter.fire({ type: 'started', tests: testsToRun })
				w.send({
					type: 'run',
					run: testsToRun,
				})
					.then((): void => {
						this.log.info('Finished running tests.')
					})
					.catch((error: Error): void => {
						this.log.error(error)
					})
					.finally((): void => {
						this.running -= 1
						if (this.running === 0) {
							this.testStatesEmitter.fire({ type: 'finished' })
						}
					})
			} else {
				this.log.error('No worker connected.')
			}
		})
	}

	/**
	 * @param testsToRun Array of IDs to run tests for.
	 * @override
	 * @inheritdoc
	 */
	public async debug(testsToRun: string[]): Promise<void> {
		const config = this.config
		if (!config || testsToRun.length === 0) {
			return
		}
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Debugging test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		return this.queue.add((): void => {
			const w = this.worker
			if (w) {
				const m = this.configMap
				const serial: string[] = []
				const con: string[] = []
				const skip = config.debuggerSkipFiles
				for (const [id, { serial: s }] of m) {
					if (s) {
						serial.push(id)
					} else {
						con.push(id)
					}
				}
				const ready = ({ config, port }): void => {
					const y = m.get(config)
					if (y) {
						connectDebugger(
							this.log,
							this.workspace,
							skip.concat(y.debuggerSkipFiles),
							port
						)
					} else {
						connectDebugger(this.log, this.workspace, skip, port)
					}
				}
				w.on('ready', ready)
				w.send({
					type: 'debug',
					port: config.debuggerPort,
					serial:
						serial.length > con.length
							? {
									x: true,
									list: con,
							  }
							: {
									x: false,
									list: serial,
							  },
					run: testsToRun,
				})
					.catch((error: Error): void => {
						this.log.error(error)
					})
					.finally((): void => {
						this.log.info('Done debugging.')
						w.off('ready', ready)
					})
			} else {
				this.log.error('No worker connected.')
			}
		})
	}

	/**
	 * @override
	 * @inheritdoc
	 */
	public cancel(): void {
		if (this.worker) {
			this.log.info('Stopping running test process...')
			this.worker.send({ type: 'stop' })
		}
	}

	/**
	 * @override
	 * @inheritdoc
	 */
	public dispose(): void {
		this.queue.clear()
		if (this.worker) {
			this.worker.disconnect()
		}
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
		this.files.clear()
		this.configMap = new Map<string, SubConfig>()
	}

	/**
	 * Reloads the configuration.
	 * @param relaunch Indicates whether worker needs to be relaunched.
	 */
	private async loadConfig(relaunch = false): Promise<LoadedConfig | null> {
		return this.queue
			.add(
				async (): Promise<LoadedConfig | null> => {
					const c = await AVAConfig.load(this.workspace.uri, this.log)
					this.config = c
					if (c && (!this.worker || relaunch)) {
						this.spawn(c)
						this.queue.add((): void => {
							const w = this.worker
							if (w) {
								w.send({
									type: 'log',
									enable: this.log.enabled,
								})
							}
						})
					} else if (this.worker && !c) {
						this.worker.disconnect()
					}
					return c
				}
			)
			.then((c): LoadedConfig | null => {
				return c || null
			})
	}

	/**
	 * Spawns a new Worker.
	 * @param config The configuration to use.
	 */
	private spawn(config: LoadedConfig): void {
		const log = this.log
		const append = (chunk: string | Buffer): void => {
			if (is.buffer(chunk)) {
				this.channel.append(chunk.toString())
			} else if (is.string(chunk)) {
				this.channel.append(chunk)
			}
		}
		this.queue.add(
			(): Promise<void> => {
				return new Promise<void>((resolve): void => {
					let failed = true
					log.debug('Spawning worker...')
					if (this.worker) {
						this.worker.disconnect()
					}
					this.worker = new Worker(config)
						.on('stdout', append)
						.on('stderr', append)
						.on('error', (error): void => {
							log.error(error)
						})
						.on('result', (result): void => {
							this.testStatesEmitter.fire({
								type: 'test',
								state: result.state,
								test: result.test,
							})
						})
						.on('done', (file): void => {
							this.testStatesEmitter.fire({
								type: 'suite',
								suite: file,
								state: 'completed',
							})
						})
						.once('connect', (w: Worker): void => {
							log.debug('Worker connected.')
							w.once('disconnect', (w: Worker): void => {
								if (this.worker === w) {
									this.worker = undefined
								}
								log.debug('Worker disconnected.')
							})
							failed = false
							resolve()
						})
						.once('exit', (w: Worker): void => {
							if (this.worker === w) {
								this.worker = undefined
							}
							if (failed) {
								resolve()
							}
						})
				})
			}
		)
	}
}
