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

import path from 'path'
//import { parse as parseStackTrace } from 'stack-trace'
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
import { Log } from 'vscode-test-adapter-util'
import { AVAConfig, LoadedConfig } from './config'
import TestTree from './test_tree'
import LoadWorker from './load_worker'
import TestWorker from './test_worker'
import DebugWorker from './debug_worker'

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

	private testProcess: TestWorker

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
		this.testProcess = new TestWorker(log, channel, this.testStatesEmitter,
			this.tree.findTest.bind(this.tree))
		this.log.info('Initializing AVA Adapter...')

		this.disposables.push(this.testsEmitter)
		this.disposables.push(this.testStatesEmitter)
		this.disposables.push(this.autorunEmitter)

		this.disposables.push(vscode.workspace.onDidChangeConfiguration(
			async (configChange): Promise<void> => {
				this.log.info('Configuration changed')
				const uri = this.workspace.uri
				if (AVAConfig.affected(uri, configChange,
					'cwd', 'config', 'env', 'nodePath', 'nodeArgv')) {
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
				for (const glob of this.config.testFileGlobs) {
					if (glob(filename)) {
						if (this.log.enabled) {
							this.log.info(`Sending reload event because ${filename} is a test file`)
						}
						this.load()
						return
					}
				}
				if (filename.startsWith(this.workspace.uri.fsPath)) {
					this.log.info('Sending autorun event')
					this.autorunEmitter.fire()
				}
			}))
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
		this.tree.clear()
		const a = [config.configFilePath, JSON.stringify(this.log.enabled)]
		const w = new LoadWorker(this.log, this.channel, this.tree)
		await w.work('./worker/loader', a, config)
		this.tree.build()
		this.testsEmitter.fire({ type: 'finished', suite: this.tree.rootNode })
	}

	public async run(testsToRun: string[]): Promise<void> {
		const config = this.config
		if (!config) return
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Running test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		this.testStatesEmitter.fire({ type: 'started', tests: testsToRun })
		const files = new Set<string>()
		const match = new Set<string>()
		const prefix = this.tree.prefixSize
		testsToRun.forEach((test): void => {
			if (this.tree.hasFile(test)) {
				files.add(test)
			} else if (test !== 'root') {
				const x = this.tree.getTest(test)
				if (x) {
					if (x.file) {
						files.add(x.file.slice(prefix))
					}
					match.add(x.label)
				} else if (this.log.enabled) {
					this.log.debug(`did not file a test with ID ${test}`)
				}
			}
		})
		const a = [
			config.configFilePath,
			JSON.stringify(this.log.enabled),
			JSON.stringify(prefix)
		]
		const basePath = path.dirname(config.configFilePath)
		files.forEach((file): void => {
			const x = path.relative(basePath, this.tree.prefixFile(file))
			this.log.info(`running file ${x}`)
			a.push(x)
		})
		if (match.size > 0) {
			a.push('--match')
			for (const m of match) {
				a.push(m)
				this.log.info(`running test ${m}`)
			}
		}
		if (this.log.enabled) {
			this.log.info(JSON.stringify(a))
		}
		return this.testProcess.work('./worker/runner.js', a, config).then((): void => {
			this.testStatesEmitter.fire({ type: 'finished' })
		})
	}

	public async debug(testsToRun: string[]): Promise<void> {
		if (!this.config || (testsToRun.length === 0)) {
			return
		}
		const config = this.config
		if (this.log.enabled) {
			const toRun = JSON.stringify(testsToRun)
			this.log.info(`Debugging test(s) ${toRun} of ${this.workspace.uri.fsPath}`)
		}
		const prefix = this.tree.prefixSize
		const a = [
			config.configFilePath,
			JSON.stringify(this.log.enabled),
			JSON.stringify(prefix),
			JSON.stringify(config.debuggerPort),
			JSON.stringify(config.serial)
		]
		const w = new DebugWorker(this.log, this.channel, {
			workspace: this.workspace,
			debuggerPort: config.debuggerPort,
			debuggerSkipFiles: config.debuggerSkipFiles
		})
		const basePath = path.dirname(config.configFilePath)
		const work = async (options: string[]): Promise<void> => {
			return w.work('./worker/debugger.js', [
				...a,
				...options
			], config)
		}
		for (const test of testsToRun) {
			if (this.tree.hasFile(test)) {
				await work([path.relative(basePath, this.tree.prefixFile(test))])
			} else if (test !== 'root') {
				const x = this.tree.getTest(test)
				if (x) {
					if (x.file) {
						await work([
							path.relative(basePath, x.file),
							x.label
						])
					} else {
						throw new TypeError('Test File Suites should have a file.')
					}
				} else if (this.log.enabled) {
					this.log.debug(`Did not find a test with ID ${test}`)
				}
			}
		}
	}

	public cancel(): void {
		if (this.testProcess.alive) {
			this.log.info('Killing running test process...')
			this.testProcess.cancel()
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
