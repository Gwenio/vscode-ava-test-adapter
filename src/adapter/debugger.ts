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
import Log from './log'

/**
 * Connects a debug session.
 * @param log The Log to use.
 * @param workspace The workspace folder.
 * @param skipFiles Files to skip.
 * @param id The SubConfig ID.
 * @param port The port to connect on.
 */
export default async function connectDebugger(
	log: Log,
	workspace: vscode.WorkspaceFolder,
	skipFiles: string[],
	port: number
): Promise<void> {
	log.info('Starting the debug session')
	await vscode.debug.startDebugging(workspace, {
		name: 'Debug AVA Tests',
		type: 'node',
		request: 'attach',
		port,
		protocol: 'inspector',
		timeout: 30000,
		stopOnEntry: false,
		skipFiles: skipFiles,
	})
	// workaround for Microsoft/vscode#70125
	await new Promise((resolve): void => {
		setImmediate(resolve)
	})
	const currentSession = vscode.debug.activeDebugSession
	if (!currentSession) {
		log.error('No active AVA debug session - aborting')
		return
	}
	return new Promise<void>((resolve): void => {
		const subscription = vscode.debug.onDidTerminateDebugSession((session): void => {
			if (currentSession !== session) {
				return
			}
			log.info('AVA Debug session ended')
			subscription.dispose()
			resolve()
		})
	})
}
