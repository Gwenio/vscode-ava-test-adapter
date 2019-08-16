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
	TestEvent
} from 'vscode-test-adapter-api'
import { Log } from 'vscode-test-adapter-util/out/log'
import { AVAConfig, LoadedConfig } from './config'
import TestTree from './test_tree'
import { Worker } from './worker'

interface IDisposable {
	dispose(): void;
}

type TestStates = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
type TestEvents = TestLoadStartedEvent | TestLoadFinishedEvent

export class AVAAdapter implements TestAdapter, IDisposable {
	private disposables: IDisposable[] = []

	private readonly testsEmitter = new vscode.EventEmitter<TestEvents>()
	private readonly testStatesEmitter = new vscode.EventEmitter<TestStates>()
	private readonly autorunEmitter = new vscode.EventEmitter<void>()

	private readonly tree: TestTree = new TestTree()
	private config: LoadedConfig | null = null

	private worker?: Worker

	public readonly workspace: vscode.WorkspaceFolder
	public readonly channel: vscode.OutputChannel
	private readonly log: Log

	public get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
		return this.testsEmitter.event
	}

	public get testStates(): vscode.Event<TestStates> {
		return this.testStatesEmitter.event
	}

	public get autorun(): vscode.Event<void> | undefined {
		return this.autorunEmitter.event
	}

	public constructor(workspace: vscode.WorkspaceFolder, channel: vscode.OutputChannel, log: Log) {
		this.workspace = workspace
		this.channel = channel
		this.log = log
		this.log.info('Initializing AVA Adapter...')

		this.disposables.push(this.testsEmitter)
		this.disposables.push(this.testStatesEmitter)
		this.disposables.push(this.autorunEmitter)

		this.disposables.push(vscode.workspace.onDidChangeConfiguration(
			async (configChange): Promise<void> => {
				this.log.info('Configuration changed')
				const uri = this.workspace.uri
				if (AVAConfig.affected(uri, configChange,
					'cwd', 'configs', 'env', 'nodePath', 'nodeArgv')) {
					this.log.info('Sending reload event')
					await this.loadConfig()
					this.load()

				} else if (AVAConfig.affected(uri, configChange,
					'debuggerPort', 'debuggerConfig', 'breakOnFirstLine', 'debuggerSkipFiles')) {
					await this.loadConfig()
				}
			}))

		this.disposables.push(vscode.workspace.onDidSaveTextDocument(
			async (document): Promise<void> => {
				if (!this.config) return
				const filename = document.uri.fsPath
				if (this.log.enabled) {
					const fsPath = this.workspace.uri.fsPath
					this.log.info(`${filename} was saved - checking if this affects ${fsPath}`)
				}
				if (filename === this.config.configFilePath) {
					this.log.info('Sending reload event')
					await this.loadConfig()
					this.load()
					return
				}
				const tree = this.tree
				if (tree.hasFile(filename.slice(tree.prefixSize))) {
					if (this.log.enabled) {
						this.log.info(`Sending reload event because ${filename} is a test file`)
					}
					this.load()
					return
				}
				if (filename.startsWith(this.workspace.uri.fsPath)) {
					this.log.info('Sending autorun event')
					this.autorunEmitter.fire()
				}
			}))
	}

	public async load(): Promise<void> {
		this.testsEmitter.fire({ type: 'started' })
		const config = this.config || await this.loadConfig()
		if (!config) {
			this.log.info(`config unavailable to load tests.`)
			this.testsEmitter.fire({ type: 'finished', suite: undefined })
			return
		}
		if (this.log.enabled) {
			this.log.info(`Loading test files of ${this.workspace.uri.fsPath}`)
		}
		if (this.worker) {
			this.tree.clear()
			return this.worker.send({
				type: 'load',
				file: config.configFilePath
			}).catch((error: Error): void => {
				this.log.error(error)

			}).finally((): void => {
				this.tree.build()
				this.testsEmitter.fire({ type: 'finished', suite: this.tree.rootNode })
			})
		} else {
			this.log.error('No worker connected.')
		}
	}

	public async run(testsToRun: string[]): Promise<void> {
		const config = this.config
		if (!config) return
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Running test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		this.testStatesEmitter.fire({ type: 'started', tests: testsToRun })
		if (this.worker) {
			return this.worker
				.send({
					type: 'run',
					run: testsToRun
				})
				.catch((error: Error): void => {
					this.log.error(error)

				})
				.finally((): void => {
					this.testStatesEmitter.fire({ type: 'finished' })
				})
		} else {
			this.log.error('No worker connected.')
		}
	}

	public async debug(testsToRun: string[]): Promise<void> {
		const config = this.config
		if (!config || (testsToRun.length === 0)) {
			return
		}
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Debugging test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		if (this.worker) {
			const l = this.connectDebugger.bind(this, config.debuggerPort, config.debuggerSkipFiles)
			return this.worker
				.on('ready', l)
				.send({
					type: 'debug',
					run: testsToRun
				})
				.catch((error: Error): void => {
					this.log.error(error)

				})
				.finally((): void => {
					if (this.worker) {
						this.worker.removeListener('ready', l)
					}
				})
		} else {
			this.log.error('No worker connected.')
		}
	}

	public cancel(): void {
		if (this.worker) {
			this.log.info('Stopping running test process...')
			this.worker.send({ type: 'stop' })
		}
	}

	public dispose(): void {
		if (this.worker) {
			this.worker.disconnect()
		}
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
		this.tree.clear()
	}

	private async loadConfig(): Promise<LoadedConfig | null> {
		const old = this.config
		const c = await AVAConfig.load(this.workspace.uri, this.log)
		this.config = c
		if (c && (!this.worker || (old && c && old.cwd !== c.cwd))) {
			this.spawn(c)
		} else if (this.worker && !c) {
			this.worker.disconnect()
		}
		return c
	}

	private async spawn(config: LoadedConfig): Promise<void> {
		if (this.worker) {
			this.worker.disconnect()
		}
		const tree = this.tree
		const log = this.log
		const w = new Worker(config)
			.on('stdout', (chunk): void => {
				this.channel.append(chunk)
			})
			.on('stderr', (chunk): void => {
				this.channel.append(chunk)
			})
			.on('error', (error): void => {
				log.error(error)
			})
			.on('message', (message): void => {
				if (log.enabled) {
					log.info(`Worker Message: ${message}`)
				}
			})
			.on('prefix', (prefix): void => {
				tree.pushPrefix(prefix, log)
			})
			.on('file', (file): void => {
				tree.pushFile(file, log)
			})
			.on('case', (test): void => {
				tree.pushTest(test, log)
			})
			.on('result', (result): void => {
				this.testStatesEmitter.fire({
					type: 'test',
					state: result.state,
					test: result.test
				})
			})
			.on('done', (file): void => {
				this.testStatesEmitter.fire({
					type: 'suite',
					suite: file,
					state: 'completed'
				})
			})
			.once('connect', (): void => {
				this.worker = w
			})
			.once('disconnect', (): void => {
				if (this.worker === w) {
					this.worker.removeAllListeners()
					this.worker = undefined
				}
			})
	}


	private async connectDebugger(port: number, skipFiles: string[]): Promise<void> {
		let currentSession: vscode.DebugSession | undefined
		this.log.info('Starting the debug session')
		await vscode.debug.startDebugging(this.workspace,
			{
				name: 'Debug AVA Tests',
				type: 'node',
				request: 'attach',
				port,
				protocol: 'inspector',
				timeout: 30000,
				stopOnEntry: false,
				skipFiles
			})
		// workaround for Microsoft/vscode#70125
		await new Promise((resolve): void => { setImmediate(resolve) })
		currentSession = vscode.debug.activeDebugSession
		if (!currentSession) {
			this.log.error('No active AVA debug session - aborting')
			return
		}
		return new Promise<void>((resolve): void => {
			const subscription = vscode.debug.onDidTerminateDebugSession((session): void => {
				if (currentSession != session) {
					return
				}
				this.log.info('AVA Debug session ended')
				subscription.dispose()
				resolve()
			})
		})
	}
}
