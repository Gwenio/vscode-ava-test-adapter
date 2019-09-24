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
import ow from 'ow'
import Log from './log'

/** The root for the extension's VSCode configurations. */
export const configRoot = 'avaExplorer'

/** Stores configuration for as specific AVA configuration. */
export interface SubConfig {
	/** The AVA configuration file name. */
	readonly file: string
	/** Whether to run tests serially while debugging. */
	readonly serial: boolean
	/** Additional files to skip while debugging. */
	readonly debuggerSkipFiles: string[]
}

/** A cached set of configuration values. */
interface ConfigCache {
	/** The current working directory for the worker. */
	cwd: string
	/** The sub-configurations. */
	configs: SubConfig[]
	/** The environment for the Worker. */
	environment: Readonly<NodeJS.ProcessEnv>
	/** The path to the NodeJS executable to use. */
	nodePath: string | undefined
	/** The CLI arguments for Node. */
	nodeArgv: string[]
	/** The preferred inspect port. */
	debuggerPort: number
	/** Files to skip while debugging. */
	debuggerSkipFiles: string[]
}

/** A set of configuration values. */
export type LoadedConfig = Readonly<ConfigCache>

const subDefault: Readonly<SubConfig> = {
	file: 'ava.config.js',
	serial: false,
	debuggerSkipFiles: [],
}

const configDefaults: LoadedConfig = {
	cwd: '',
	configs: [subDefault],
	environment: {},
	nodePath: undefined,
	nodeArgv: [],
	debuggerPort: 9229,
	debuggerSkipFiles: [],
}

const configValidate: { [K in keyof LoadedConfig]: (_: LoadedConfig[K]) => void } = {
	cwd: ow.create('cwd', ow.string),
	configs: ow.create(
		'configs',
		ow.array.nonEmpty.ofType(
			ow.object.partialShape({
				file: ow.any(ow.nullOrUndefined, ow.string.nonEmpty),
				serial: ow.optional.boolean,
				debuggerSkipFiles: ow.optional.array.ofType(ow.string.nonEmpty),
			})
		)
	),
	environment: ow.create('env', ow.object.plain.valuesOfType(ow.string)),
	nodePath: ow.create('nodePath', ow.any(ow.undefined, ow.string.nonEmpty)),
	nodeArgv: ow.create('nodeArgv', ow.array.ofType(ow.string.nonEmpty)),
	debuggerPort: ow.create('debuggerPort', ow.number.lessThanOrEqual(65535)),
	debuggerSkipFiles: ow.create('debuggerSkipFiles', ow.optional.array.ofType(ow.string.nonEmpty)),
}

export type ConfigKey = keyof LoadedConfig

const configAliases = {
	environment: 'env',
}

interface ConfigMap {
	get(key: ConfigKey): string
	keys(): IterableIterator<ConfigKey>
	entries(): IterableIterator<[ConfigKey, string]>
}

const configAliasMap = new Map<ConfigKey, string>(
	Object.keys(configValidate).map((key): [ConfigKey, string] => [
		key as ConfigKey,
		configAliases[key] || key,
	])
) as ConfigMap

const configMap = new Map<ConfigKey, string>(
	Object.keys(configValidate).map((key): [ConfigKey, string] => [
		key as ConfigKey,
		`${configRoot}.${configAliases[key] || key}`,
	])
) as ConfigMap

export interface ConfigQuery {
	<T>(key: string): T | undefined
}

export type ConfigUpdate = (key: string) => boolean

/** Contains utilities for managing configuration. */
export class Config<X extends string> {
	private readonly defaultNode?: string
	private readonly fsPath: string
	private readonly extra = new Map<X, string>()
	private readonly log: Log
	private cache: LoadedConfig

	public get current(): LoadedConfig {
		return this.cache
	}

	public constructor(
		fsPath: string,
		query: ConfigQuery,
		log: Log,
		additional: X[],
		node?: string
	) {
		this.fsPath = fsPath
		this.defaultNode = node
		this.log = log
		const initial: ConfigCache = { ...configDefaults }
		for (const k of configMap.keys()) {
			this.setValue(initial, k, query)
		}
		this.cache = initial
		for (const k of additional) {
			this.extra.set(k, `${configRoot}.${k}`)
		}
	}

	public update(event: ConfigUpdate, query: ConfigQuery): Set<ConfigKey | X> {
		const affected = new Set<ConfigKey | X>()
		const c: ConfigCache = { ...this.cache }
		for (const [key, alias] of configMap.entries()) {
			if (event(alias)) {
				this.log.info(`${key} updated`)
				affected.add(key)
				this.setValue(c, key, query)
			}
		}
		if (affected.size > 0) {
			this.cache = c
		}
		for (const [key, alias] of this.extra.entries()) {
			if (event(alias)) {
				affected.add(key)
			}
		}
		return affected
	}

	private getNode(query: ConfigQuery): LoadedConfig['nodePath'] {
		const value = query<LoadedConfig['nodePath']>('nodePath')
		try {
			configValidate['nodePath'](value)
		} catch (error) {
			this.log.error('Found invalid value for avaExplorer.nodePath', error)
			return undefined
		}
		return value
	}

	private getValue<K extends ConfigKey>(key: K, query: ConfigQuery): LoadedConfig[K] {
		const value = query<LoadedConfig[K]>(configAliasMap.get(key))
		if (value === undefined) {
			this.log.info(`No value for ${key} set, using default.`)
			return configDefaults[key]
		} else {
			try {
				const f = configValidate[key] as (_: LoadedConfig[K]) => void
				f(value)
			} catch (error) {
				this.log.error(`Found invalid value for ${configMap.get(key)}`, error)
				return configDefaults[key]
			}
			return value
		}
	}

	private setValue(c: ConfigCache, key: ConfigKey, query: ConfigQuery): void {
		switch (key) {
			case 'cwd':
				c[key] = path.resolve(this.fsPath, this.getValue(key, query))
				return
			case 'configs':
				c[key] = this.getValue(key, query).map(
					({ file, serial, debuggerSkipFiles }): SubConfig => {
						return {
							file: file || subDefault.file,
							serial: serial === true,
							debuggerSkipFiles: debuggerSkipFiles || [],
						}
					}
				)
				return
			case 'nodePath':
				c[key] = this.getNode(query) || this.defaultNode
				return
			case 'environment':
				c[key] = this.getValue(key, query)
				return
			case 'nodeArgv':
				c[key] = this.getValue(key, query)
				return
			case 'debuggerPort':
				c[key] = this.getValue(key, query)
				return
			case 'debuggerSkipFiles':
				c[key] = this.getValue(key, query)
				return
		}
	}
}
