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
import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api'
import { TestAdapterRegistrar } from 'vscode-test-adapter-util/out/registrar'
import { Log } from 'vscode-test-adapter-util/out/log'
import { detectNodePath } from 'vscode-test-adapter-util/out/misc'
import { AVAAdapter } from './src/adapter'
import { configRoot } from './src/config'

/**
 * Activates the extension.
 * @param context The ExtensionContext.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0]
	const channel = vscode.window.createOutputChannel('AVA Tests')
	const log = new Log(configRoot, workspaceFolder, 'AVA Explorer Log')
	context.subscriptions.push(log)

	const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId)
	if (log.enabled) log.info(`Test Explorer ${testExplorerExtension ? '' : 'not '}found`)
	if (testExplorerExtension) {
		const testHub = testExplorerExtension.exports
		const nodePath = await detectNodePath()
		context.subscriptions.push(
			new TestAdapterRegistrar(
				testHub,
				(workspaceFolder): AVAAdapter =>
					new AVAAdapter(workspaceFolder, channel, log, nodePath),
				log
			)
		)
	}
}
