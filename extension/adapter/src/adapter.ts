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

import { Writable } from 'stream'
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
import is from '@sindresorhus/is'
import Cancelable from 'p-cancelable'
import delay from 'delay'
import Disposable from './disposable'
import Log from './log'
import { Config, LoadedConfig, SubConfig, configRoot, ConfigKey } from './config'
import TestTree from './test_tree'
import { Worker } from './worker'
import { SerialQueue } from './queue'
import connectDebugger from './debugger'
import Watcher from './watcher'

/** Events for test states. */
type TestStates = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
/** Test Start and Finish events. */
type TestEvents = TestLoadStartedEvent | TestLoadFinishedEvent

/** The test adapter. */
export class AVAAdapter implements TestAdapter, Disposable {
	/** Array of objects to dispose of when dispose() is called. */
	private disposables: Disposable[] = []
	/** Emits test events. */
	private readonly testsEmitter = new vscode.EventEmitter<TestEvents>()
	/** Emits test state events. */
	private readonly testStatesEmitter = new vscode.EventEmitter<TestStates>()
	/** Triggers auto test runs. */
	private readonly autorunEmitter = new vscode.EventEmitter<void>()
	/** Manages the handling of file change events. */
	private readonly watcher: Watcher
	/** Map of configuration IDs to SubConfigs. */
	private configMap = new Map<string, SubConfig>()
	/** The loaded settings. */
	private config: Config<'logpanel' | 'logfile'>
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
	/** Stream to forward worker output to channel. */
	private readonly output = new Writable({
		objectMode: false,
		write: (chunk: string | Buffer, _encoding, callback): void => {
			if (is.buffer(chunk)) {
				this.channel.append(chunk.toString())
			} else if (is.string(chunk)) {
				this.channel.append(chunk)
			} else {
				this.log.warn(
					'The output stream recieved a chunk that was not a Buffer nor a string.'
				)
			}
			callback()
		},
	})
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
	public get autorun(): vscode.Event<void> {
		return this.autorunEmitter.event
	}

	/**
	 * Constructs the adapter and sets up the VSCode event handlers.
	 * @param workspace The VSCode Workspace.
	 * @param channel The VSCode output channel.
	 * @param log The output Log.
	 * @param nodePath The default NodeJS installation to use.
	 */
	public constructor(
		workspace: vscode.WorkspaceFolder,
		channel: vscode.OutputChannel,
		log: Log,
		nodePath?: string
	) {
		this.workspace = workspace
		this.channel = channel
		this.log = log
		log.info('Initializing AVA Adapter...')
		if (nodePath) {
			log.info(`Using default NodeJS: ${nodePath}`)
		} else {
			log.warn(`No default NodeJS found.`)
		}

		const fsPath = workspace.uri.fsPath

		this.watcher = new Watcher(log)
			.on('run', this.autorunEmitter.fire.bind(this.autorunEmitter))
			.on('load', this.load.bind(this))

		const store = vscode.workspace.getConfiguration(configRoot, this.workspace.uri)
		this.config = new Config(
			fsPath,
			<T>(key: string): T | undefined => store.get<T>(key),
			log,
			['logpanel', 'logfile'],
			nodePath
		)

		this.spawn(this.config.current)

		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument((document): void => {
				const file = document.uri.fsPath
				this.watcher.changed(file, file.startsWith(this.workspace.uri.fsPath))
			})
		)
		this.disposables.push(
			vscode.workspace.onDidChangeConfiguration((configChange): void => {
				this.queue.add(this.updateConfig.bind(this, configChange))
			})
		)
		this.disposables.push(this.watcher)
		this.disposables.push(this.testsEmitter)
		this.disposables.push(this.testStatesEmitter)
		this.disposables.push(this.autorunEmitter)
	}

	/**
	 * @override
	 * @inheritdoc
	 */
	public async load(): Promise<void> {
		this.testsEmitter.fire({ type: 'started' })
		const config = this.config.current
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
				this.watcher.watch = tree.getFiles
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
		const { serialRuns } = this.config.current
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Running test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		return this.queue.add(
			async (): Promise<void> => {
				const w = this.worker
				if (w) {
					this.running += 1
					this.testStatesEmitter.fire({ type: 'started', tests: testsToRun })
					const p = w
						.send({
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
					if (serialRuns) return p
				} else {
					this.log.error('No worker connected.')
				}
			}
		)
	}

	/**
	 * @param testsToRun Array of IDs to run tests for.
	 * @override
	 * @inheritdoc
	 */
	public async debug(testsToRun: string[]): Promise<void> {
		const config = this.config.current
		if (testsToRun.length === 0) {
			return
		}
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Debugging test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		return this.queue.add(
			async (): Promise<void> => {
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
					const p = w
						.send({
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
					if (config.serialRuns) return p
				} else {
					this.log.error('No worker connected.')
				}
			}
		)
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
		this.configMap = new Map<string, SubConfig>()
	}

	private setWorkerLog(): void {
		this.queue.add((): void => {
			const w = this.worker
			if (w) {
				w.send({ type: 'log', enable: this.log.enabled })
			}
		})
	}

	private async updateConfig(event: vscode.ConfigurationChangeEvent): Promise<void> {
		this.log.info('Processing configuration changes...')
		const affects = event.affectsConfiguration.bind(event)
		const uri = this.workspace.uri
		const check = (key: string): boolean => affects(key, uri)
		const store = vscode.workspace.getConfiguration(configRoot, this.workspace.uri)
		const list = this.config.update(check, <T>(key: string): T | undefined => store.get<T>(key))
		const has = list.has.bind(list)
		const affected = (...x: (ConfigKey | 'logpanel' | 'logfile')[]): boolean => x.some(has)
		if (affected('cwd', 'environment', 'nodePath', 'nodeArgv')) {
			this.log.info('Re-spawning worker and sending reload event')
			this.spawn(this.config.current).then(this.load.bind(this))
			return
		} else if (has('configs')) {
			this.log.info('Sending reload event')
			if (!this.worker) {
				this.spawn(this.config.current).then(this.load.bind(this))
			} else if (affected('logpanel', 'logfile')) {
				this.setWorkerLog()
				this.load()
			}
			return
		} else if (!this.worker) {
			this.spawn(this.config.current)
		} else if (affected('logpanel', 'logfile')) {
			this.channel.appendLine('[Main] Logging settings changed.')
			this.setWorkerLog()
		}
	}

	/**
	 * Spawns a new Worker.
	 * @param config The configuration to use.
	 */
	private spawn(config: LoadedConfig): Promise<void> {
		const log = this.log
		return this.queue.add(
			(): Promise<void> => {
				const p = new Cancelable<void>((resolve, _reject, onCancel): void => {
					onCancel.shouldReject = true
					log.debug('Spawning worker...')
					if (this.worker) {
						this.worker.disconnect()
					}
					const worker = new Worker(config, this.output)
						.once('exit', (w: Worker): void => {
							if (this.worker === w) {
								this.worker = undefined
							}
						})
						.on('error', (error): void => {
							log.error(error)
						})
						.once('connect', (w: Worker): void => {
							log.debug('Worker connected.')
							this.watcher.activate = true
							w.once('disconnect', (w: Worker): void => {
								if (this.worker === w) {
									this.watcher.activate = false
									this.worker = undefined
								}
								log.debug('Worker disconnected.')
							})
							this.setWorkerLog()
							resolve()
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
					this.worker = worker
					onCancel((): void => {
						if (this.worker === worker) {
							this.watcher.activate = false
							this.worker = undefined
						}
						worker.disconnect()
					})
				})
				delay(config.timeout).then((): void => {
					p.cancel('Attempt to connect to worker timed out.')
				})
				return p.catch((error): void => {
					log.error(error)
				})
			}
		)
	}
}
