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

	private worker: Worker = new Worker()

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
					this.config = await AVAConfig.load(this.workspace.uri, this.log)
					this.load()

				} else if (AVAConfig.affected(uri, configChange,
					'debuggerPort', 'debuggerConfig', 'breakOnFirstLine', 'debuggerSkipFiles')) {
					this.config = await AVAConfig.load(uri, this.log)
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
					this.config = null
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

		const w = this.worker
		const tree = this.tree
		w.on('error', (error): void => {
			log.error(error)
		})
		w.on('message', (message): void => {
			if (log.enabled) {
				log.info(`Worker Message: ${message}`)
			}
		})
		w.on('prefix', (prefix): void => {
			tree.pushPrefix(prefix, log)
		})
		w.on('file', (file): void => {
			tree.pushFile(file, log)
		})
		w.on('case', (test): void => {
			tree.pushTest(test, log)
		})
		w.on('result', (result): void => {
			this.testStatesEmitter.fire({
				type: 'test',
				state: result.state,
				test: result.test
			})
		})
		w.on('done', (file): void => {
			this.testStatesEmitter.fire({
				type: 'suite',
				suite: file,
				state: 'completed'
			})
		})
		w.on('stdout', (chunk): void => {
			this.channel.append(chunk)
		})
		w.on('stderr', (chunk): void => {
			this.channel.append(chunk)
		})
	}

	public async load(): Promise<void> {
		this.testsEmitter.fire({ type: 'started' })
		if (!this.config) {
			this.config = await AVAConfig.load(this.workspace.uri, this.log)
		}
		const config = this.config
		if (!config) {
			this.log.info(`config unavailable to load tests.`)
			this.testsEmitter.fire({ type: 'finished', suite: undefined })
			return
		}
		if (this.log.enabled) {
			this.log.info(`Loading test files of ${this.workspace.uri.fsPath}`)
		}
		return this.worker.enque((): void => {
			this.tree.clear()
			this.worker.send({
				type: 'load',
				file: config.configFilePath
			})
		}, (error: Error): void => {
			this.log.error(error)
		}).finally((): void => {
			this.tree.build()
			this.testsEmitter.fire({ type: 'finished', suite: this.tree.rootNode })
		})

	}

	public async run(testsToRun: string[]): Promise<void> {
		const config = this.config
		if (!config) return
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Running test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		this.testStatesEmitter.fire({ type: 'started', tests: testsToRun })
		return this.worker.enque((): void => {
			this.worker.send({
				type: 'run',
				run: testsToRun
			})
		}, (error: Error): void => {
			this.log.error(error)
		}).finally((): void => {
			this.testStatesEmitter.fire({ type: 'finished' })
		})
	}

	public async debug(testsToRun: string[]): Promise<void> {
		if (!this.config || (testsToRun.length === 0)) {
			return
		}
		//const config = this.config
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Debugging test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		return this.worker.enque((): void => {
			this.worker.send({
				type: 'debug',
				run: testsToRun
			})
		}, (error: Error): void => {
			this.log.error(error)
		})
	}

	public cancel(): void {
		if (this.worker.alive) {
			this.log.info('Stopping running test process...')
			this.worker.send({ type: 'stop' })
		}
	}

	public dispose(): void {
		this.cancel()
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
		this.tree.clear()
	}
}
