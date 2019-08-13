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
import { Log } from 'vscode-test-adapter-util'
import Worker from './worker'

interface DebugWorkerConfig {
	workspace: vscode.WorkspaceFolder;
	debuggerPort: number;
	debuggerConfig?: string;
	debuggerSkipFiles: string[];
}

export default class DebugWorker extends Worker<string> {
	private workspace: vscode.WorkspaceFolder
	private debuggerPort: number
	private debuggerConfig?: string
	private debuggerSkipFiles: string[]

	public constructor(l: Log, c: vscode.OutputChannel, x: DebugWorkerConfig) {
		super(l, c)
		this.workspace = x.workspace
		this.debuggerConfig = x.debuggerConfig
		this.debuggerPort = x.debuggerPort
		this.debuggerSkipFiles = x.debuggerSkipFiles
	}

	protected messageHandler(message: string): void {
		if (typeof message === 'string') {
			switch (message) {
				case 'debug':
					this.connectDebugger()
					break
				default:
					this.log.info(`Debug Worker: ${message}`)
					break
			}
		} else {
			throw new TypeError('Unexpected message from debugger worker.')
		}
	}

	protected exitHandler(code: number | null): void {
		this.log.info(`Debug Worker finished with code: ${code}`)
	}

	private async connectDebugger(): Promise<void> {
		let currentSession: vscode.DebugSession | undefined
		this.log.info('Starting the debug session')
		await vscode.debug.startDebugging(this.workspace,
			this.debuggerConfig || {
				name: 'Debug AVA Tests',
				type: 'node',
				request: 'attach',
				port: this.debuggerPort,
				protocol: 'inspector',
				timeout: 30000,
				stopOnEntry: false,
				skipFiles: this.debuggerSkipFiles
			})
		// workaround for Microsoft/vscode#70125
		await new Promise((resolve): void => { setImmediate(resolve) })
		currentSession = vscode.debug.activeDebugSession
		if (!currentSession) {
			this.log.error('No active AVA debug session - aborting')
			return
		}
		// Kill the process to ensure we're good once the de
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
