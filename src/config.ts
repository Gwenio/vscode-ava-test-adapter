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
import vscode from 'vscode'
import { Log } from 'vscode-test-adapter-util/out/log'
import { detectNodePath } from 'vscode-test-adapter-util/out/misc'

const configRoot = 'avaExplorer'

export class AVAConfig {
	public static affected(uri: vscode.Uri,
		event: vscode.ConfigurationChangeEvent,
		...settings: string[]): boolean {
		const base = `${configRoot}.`
		for (const check in settings) {
			if (event.affectsConfiguration(`${base}${check}`, uri)) {
				return true
			}
		}
		return false
	}

	public static async load(uri: vscode.Uri, log: Log): Promise<LoadedConfig | null> {
		const adapterConfig = vscode.workspace.getConfiguration(configRoot, uri)

		const cwd = path.resolve(uri.fsPath, adapterConfig.get<string>('cwd') || '')

		const configs: SubConfig[] = adapterConfig.get<SubConfig[]>('configs') || [
			{
				file: 'ava.config.js',
				serial: false,
				debuggerSkipFiles: []
			}
		]

		let nodePath: string | undefined = adapterConfig.get<string>('nodePath') || undefined
		if (nodePath === 'default' || nodePath === undefined) {
			nodePath = await detectNodePath()
		}

		const configEnvironment: NodeJS.ProcessEnv = {
			...(adapterConfig.get('env') || {})
		}
		if (log.enabled) {
			const output = JSON.stringify(configEnvironment)
			log.debug(`Using environment variable config: ${output}`)
		}
		const environment: NodeJS.ProcessEnv = { ...process.env }
		for (const key in configEnvironment) {
			const value = configEnvironment[key]
			if ((value === undefined) || (value === null)) {
				delete environment.key
			} else {
				environment[key] = String(value)
			}
		}

		if (log.enabled) log.debug(`Using nodePath: ${nodePath}`)

		const nodeArgv: string[] = adapterConfig.get<string[]>('nodeArgv') || []
		if (log.enabled) log.debug(`Using node arguments: ${nodeArgv}`)

		const debuggerPort = adapterConfig.get<number>('debuggerPort') || 9229

		const debuggerSkipFiles = adapterConfig.get<string[]>('debuggerSkipFiles') || []

		return {
			cwd,
			configs: configs.map((c): SubConfig => {
				const configFilePath = path.resolve(cwd, c.file || 'ava.config.js')
				if (log.enabled) log.debug(`Using config file: ${configFilePath}`)
				return {
					file: configFilePath,
					serial: c.serial || false,
					debuggerSkipFiles: c.debuggerSkipFiles
				}
			}),
			environment,
			nodePath,
			nodeArgv,
			debuggerPort,
			debuggerSkipFiles
		}
	}

	public static createLog(workspace: vscode.WorkspaceFolder, logName: string): Log {
		return new Log(configRoot, workspace, logName)
	}
}

export interface SubConfig {
	file: string;
	serial: boolean;
	debuggerSkipFiles: string[];
}

export interface LoadedConfig {
	cwd: string;
	configs: SubConfig[];
	environment: NodeJS.ProcessEnv;
	nodePath: string | undefined;
	nodeArgv: string[];
	debuggerPort: number;
	debuggerSkipFiles: string[];
}
