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
				file: null,
				/* eslint unicorn/prevent-abbreviations: "off" */
				env: {},
				serial: false,
				debuggerSkipFiles: []
			}
		]
		const c = configs[0]
		log.debug(JSON.stringify(c))

		const configFilePath = path.resolve(cwd, c.file || 'ava.config.js')
		if (log.enabled) log.debug(`Using config file: ${configFilePath}`)

		const configEnvironment: NodeJS.ProcessEnv = {
			...(adapterConfig.get('env') || {}),
			...(c.env)
		}
		if (log.enabled) {
			log.debug(`Using environment variable config: ${JSON.stringify(configEnvironment)}`)
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

		let nodePath: string | undefined = adapterConfig.get<string>('nodePath') || undefined
		if (nodePath === 'default' || nodePath === undefined) {
			nodePath = await detectNodePath()
		}
		if (log.enabled) log.debug(`Using nodePath: ${nodePath}`)

		let nodeArgv: string[] = adapterConfig.get<string[]>('nodeArgv') || []
		if (log.enabled) log.debug(`Using node arguments: ${nodeArgv}`)

		const debuggerPort = adapterConfig.get<number>('debuggerPort') || 9229

		const debuggerSkipFiles = adapterConfig.get<string[]>('debuggerSkipFiles') || []

		return {
			cwd,
			configFilePath,
			environment,
			nodePath,
			nodeArgv,
			serial: c.serial || false,
			debuggerPort,
			debuggerSkipFiles: debuggerSkipFiles.concat(c.debuggerSkipFiles)
		}
	}

	public static createLog(workspace: vscode.WorkspaceFolder, logName: string): Log {
		return new Log(configRoot, workspace, logName)
	}
}

export interface SubConfig {
	file: string | null;
	/* eslint unicorn/prevent-abbreviations: "off" */
	env: NodeJS.ProcessEnv;
	serial: boolean;
	debuggerSkipFiles: string[];
}

export interface LoadedConfig {
	cwd: string;
	configFilePath: string;
	environment: NodeJS.ProcessEnv;
	nodePath: string | undefined;
	nodeArgv: string[];
	serial: boolean;
	debuggerPort: number;
	debuggerSkipFiles: string[];
}
