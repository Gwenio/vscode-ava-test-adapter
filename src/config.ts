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

import * as path from 'path'
import { IMinimatch, Minimatch } from 'minimatch'
import * as vscode from 'vscode'
import { AVA } from 'ava/namespace'
import loadAVAConfig from 'ava/lib/load-config'
import { normalizeGlobs } from 'ava/lib/globs'
import normalizeExtensions from 'ava/lib/extensions'
import { validate as validateBabel } from 'ava/lib/babel-pipeline'
import { Log, detectNodePath } from 'vscode-test-adapter-util'

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

	public static getGlobs(patterns: string[], cwd: string,
		log: Log, type: string): IMinimatch[] {
		const fileGlobs: IMinimatch[] = []
		if (log.enabled) {
			for (const relativeGlob of patterns) {
				const absoluteGlob = path.resolve(cwd, relativeGlob)
				log.debug(`Using ${type} file glob: ${absoluteGlob}`)
				fileGlobs.push(new Minimatch(absoluteGlob))
			}
		} else {
			for (const relativeGlob of patterns) {
				const absoluteGlob = path.resolve(cwd, relativeGlob)
				fileGlobs.push(new Minimatch(absoluteGlob))
			}
		}
		return fileGlobs
	}

	public static async load(uri: vscode.Uri, log: Log): Promise<LoadedConfig | null> {
		const adapterConfig = vscode.workspace.getConfiguration(configRoot, uri)

		const cwd = path.resolve(uri.fsPath, adapterConfig.get<string>('cwd') || '')

		const relativeConfigFilePath = adapterConfig.get<string>('config') || 'ava.config.json'
		const configFilePath = path.resolve(cwd, relativeConfigFilePath)
		if (log.enabled) log.debug(`Using config file: ${configFilePath}`)

		let avaConfig: AVA.Configuration
		try {
			avaConfig = loadAVAConfig({
				configFile: configFilePath,
				resolveFrom: cwd,
				defaults: {}
			})
		} catch (error) {
			if (error instanceof Error && log.enabled) {
				log.error(`Error loading AVA configuration: ${error.message}`)
			}
			return null
		}
		const babelConfig = validateBabel(avaConfig.babel || {})
		const extensions = normalizeExtensions(avaConfig.extensions || [],
			babelConfig)
		const globs = normalizeGlobs(avaConfig.files,
			avaConfig.helpers, avaConfig.sources, extensions.all)

		const testFileGlobs: IMinimatch[] = AVAConfig.getGlobs(globs.testPatterns,
			cwd, log, 'test')
		const helperFileGlobs: IMinimatch[] = AVAConfig.getGlobs(globs.helperPatterns,
			cwd, log, 'helper')
		const sourceFileGlobs: IMinimatch[] = AVAConfig.getGlobs(globs.sourcePatterns,
			cwd, log, 'source')

		const configEnvironment: NodeJS.ProcessEnv = adapterConfig.get('env') || {}
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

		const debuggerConfig = adapterConfig.get<string>('debuggerConfig') || undefined

		const breakOnFirstLine: boolean = adapterConfig.get('breakOnFirstLine') === true
		if (log.enabled) log.debug(`Using breakOnFirstLine: ${breakOnFirstLine}`)

		const debuggerSkipFiles = adapterConfig.get<string[]>('debuggerSkipFiles') || []

		return {
			cwd,
			configFilePath,
			testFileGlobs,
			helperFileGlobs,
			sourceFileGlobs,
			environment,
			nodePath,
			nodeArgv,
			debuggerPort,
			debuggerConfig,
			breakOnFirstLine,
			debuggerSkipFiles
		}
	}

	public static createLog(workspace: vscode.WorkspaceFolder, logName: string): Log {
		return new Log(configRoot, workspace, logName)
	}
}

export interface LoadedConfig {
	cwd: string;
	configFilePath: string;
	testFileGlobs: IMinimatch[];
	helperFileGlobs: IMinimatch[];
	sourceFileGlobs: IMinimatch[];
	environment: NodeJS.ProcessEnv;
	nodePath: string | undefined;
	nodeArgv: string[];
	debuggerPort: number;
	debuggerConfig: string | undefined;
	breakOnFirstLine: boolean;
	debuggerSkipFiles: string[];
}
