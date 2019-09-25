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

/** The default values for a SubConfig. */
const subDefault: Readonly<SubConfig> = {
	file: 'ava.config.js',
	serial: false,
	debuggerSkipFiles: [],
}

/** The default values for a LoadedConfig. */
const configDefaults: LoadedConfig = {
	cwd: '',
	configs: [subDefault],
	environment: {},
	nodePath: undefined,
	nodeArgv: [],
	debuggerPort: 9229,
	debuggerSkipFiles: [],
}

/** Functions to validate LoadedConfig values. */
const configValidate: { [K in keyof LoadedConfig]: (_: LoadedConfig[K]) => void } = {
	cwd: ow.create('cwd', ow.string),
	configs: ow.create('configs', ow.array.nonEmpty),
	environment: ow.create('env', ow.object.plain),
	nodePath: ow.create('nodePath', ow.any(ow.undefined, ow.string.nonEmpty)),
	nodeArgv: ow.create('nodeArgv', ow.array.ofType(ow.string.nonEmpty)),
	debuggerPort: ow.create('debuggerPort', ow.number.lessThanOrEqual(65535)),
	debuggerSkipFiles: ow.create('debuggerSkipFiles', ow.optional.array.ofType(ow.string.nonEmpty)),
}

const subValidate = ow.create(
	ow.object.partialShape({
		file: ow.optional.string.nonEmpty,
		serial: ow.optional.boolean,
		debuggerSkipFiles: ow.optional.array.ofType(ow.string),
	})
)

/** The type for the keys of LoadedConfig. */
export type ConfigKey = keyof LoadedConfig

/** A mapping of aliases between ConfigKey and the actual config keys. */
const configAliases: { readonly [K in ConfigKey]?: string } = {
	environment: 'env',
}

/** Immutable map of ConfigKey to string. */
interface ConfigMap {
	/**
	 * Gets the mapped string for a key.
	 * @param key The key to get the mapping for.
	 */
	get(key: ConfigKey): string

	/** Gets an iterator for the map's keys. */
	keys(): IterableIterator<ConfigKey>

	/** Gets an iterator for the map's entries. */
	entries(): IterableIterator<[ConfigKey, string]>
}

/** Map of ConfigKey to actual config keys. */
const configAliasMap = new Map<ConfigKey, string>(
	Object.keys(configValidate).map((key): [ConfigKey, string] => [
		key as ConfigKey,
		configAliases[key] || key,
	])
) as ConfigMap

/** Map of ConfigKey to actual config keys scoped to configRoot. */
const configMap = new Map<ConfigKey, string>(
	Object.keys(configValidate).map((key): [ConfigKey, string] => [
		key as ConfigKey,
		`${configRoot}.${configAliases[key] || key}`,
	])
) as ConfigMap

/** Callback type for querying the current value of a configuration. */
export interface ConfigQuery {
	/**
	 * Gets a the setting associated with key.
	 * @param key A value from configAliasMap to query for.
	 * @returns The current setting or undefined if not set.
	 */
	<T>(key: string): T | undefined
}

/**
 * Callback type for checking if a configuration was changed.
 * @param key A value from configMap to check.
 * @returns Whether the setting was changed.
 */
export type ConfigUpdate = (key: string) => boolean

/** Contains utilities for managing configuration. */
export class Config<X extends string> {
	/** The default Node executable path, if one is set. */
	private readonly defaultNode?: string
	/** The working directory root path. */
	private readonly fsPath: string
	/** Extra configuration keys to monitor for changes. */
	private readonly extra = new Map<X, string>()
	/** The Log to use. */
	private readonly log: Log
	/** The current configuration values. */
	private cache: LoadedConfig

	/** Gets the current configuration values. */
	public get current(): LoadedConfig {
		return this.cache
	}

	/**
	 * Constructs a new Config.
	 * @param fsPath The working directory root path.
	 * @param query Callback to load initial settings.
	 * @param log The Log to use.
	 * @param additional Additional configuration keys to monitor for changes.
	 * @param node The default Node executable path, if one is found.
	 */
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

	/**
	 * Called to update the Config when one or more settings change.
	 * @param event The callback representing a change event.
	 * @param query The callback to query new settings with.
	 * @returns Returns a Set of configuration keys that were changed.
	 */
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

	/**
	 * Gets the configured Node executable path.
	 * @param query The callback to get the currently set Node path.
	 */
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

	/**
	 * Gets the current value for a ConfigKey.
	 * @param key The ConfigKey to get a value for.
	 * @param query The callback to get the value from.
	 * @returns The current value for the key or the default if a valid value was not found.
	 */
	private getValue<K extends ConfigKey>(key: K, query: ConfigQuery): LoadedConfig[K] {
		const value = query<LoadedConfig[K]>(configAliasMap.get(key))
		if (value === undefined) {
			this.log.info(`No value for ${configMap.get(key)} set, using default.`)
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

	/**
	 * Sanitizes a newly loaded environment.
	 * @param value The environment to sanitize.
	 */
	private environment(value: Readonly<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
		const x: NodeJS.ProcessEnv = { ...value }
		for (const [key, value] of Object.entries(x)) {
			switch (typeof value) {
				case 'string':
					break
				case 'number':
					x[key] = (value as number).toString()
					break
				case 'boolean':
					x[key] = (value as boolean) ? 'true' : 'false'
					break
				default:
					this.log.warn(
						'The values in avaExplorer.env should be string, number, or boolean.',
						`avaExplorer.env.['${key}'] will be set to an empty string.`
					)
					x[key] = ''
					break
			}
		}
		return x
	}

	/**
	 * Sanitizes an array of newly loaded SubConfig objects.
	 * @param value The array of SubConfig objects to sanitize.
	 */
	private configs(value: SubConfig[]): SubConfig[] {
		return value.map(
			(x: SubConfig): SubConfig => {
				try {
					subValidate(x)
				} catch (error) {
					this.log.error(
						'Found invalid value in avaExplorer.configs, replacing it with default.',
						error
					)
					return subDefault
				}
				const { file, serial, debuggerSkipFiles } = x
				return {
					file: file || subDefault.file,
					serial: serial === true,
					debuggerSkipFiles: debuggerSkipFiles || [],
				}
			}
		)
	}

	/**
	 * Sets the value for a ConfigKey on a configuration cache.
	 * @param c A cache of configuration values to update.
	 * @param key The key of the value to set.
	 * @param query The callback to get the value from.
	 */
	private setValue(c: ConfigCache, key: ConfigKey, query: ConfigQuery): void {
		switch (key) {
			case 'cwd':
				// resolve from fsPath
				c[key] = path.resolve(this.fsPath, this.getValue(key, query))
				return
			case 'configs':
				c[key] = this.configs(this.getValue(key, query))
				return
			case 'environment':
				c[key] = this.environment(this.getValue(key, query))
				return
			case 'nodePath':
				// use defaultNode if a path is not set
				c[key] = this.getNode(query) || this.defaultNode
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
