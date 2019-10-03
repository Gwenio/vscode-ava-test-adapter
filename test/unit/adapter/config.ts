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
import anyTest, { TestInterface } from 'ava'
import sinon, { SinonSandbox } from 'sinon'
//import delay from 'delay'
import Log from '../../../src/adapter/log'
import { Config, LoadedConfig, configRoot, ConfigKey } from '../../../src/adapter/config'

interface Context {
	/** Isolated sinon sandbox. */
	sandbox: SinonSandbox
}

const test = anyTest as TestInterface<Context>

test.beforeEach(
	async (t): Promise<void> => {
		t.context.sandbox = sinon.createSandbox()
	}
)

type extraKey = 'logpanel' | 'logfile'
const extraKeys: extraKey[] = ['logpanel', 'logfile']
const nodePath = process.execPath
const fsPath = process.cwd()
const defaultPort = 9229
const defaultConfig: LoadedConfig = {
	cwd: path.resolve(fsPath, ''),
	configs: [
		{
			file: 'ava.config.js',
			serial: false,
			debuggerSkipFiles: [],
		},
	],
	environment: {},
	serialRuns: false,
	nodePath,
	nodeArgv: [],
	debuggerPort: defaultPort,
	debuggerSkipFiles: [],
	timeout: 10000,
}
const alternateConfig: LoadedConfig = {
	cwd: path.resolve(fsPath, 'dir'),
	configs: [
		{
			file: 'ava.coverage.js',
			serial: true,
			debuggerSkipFiles: ['events.js'],
		},
	],
	environment: {
		x: 'world',
	},
	serialRuns: true,
	nodePath: path.resolve(path.dirname(nodePath), '12.10.0', path.basename(nodePath)),
	nodeArgv: ['-r', 'ts-node/register'],
	debuggerPort: 10000,
	debuggerSkipFiles: ['fs.js'],
	timeout: 5000,
}
const aliases: { [key: string]: ConfigKey } = {
	/* eslint unicorn/prevent-abbreviations: "off" */
	env: 'environment',
	workerTimeout: 'timeout',
}
const baseKeys = [
	'cwd',
	'configs',
	'env',
	'nodePath',
	'nodeArgv',
	'debuggerPort',
	'debuggerSkipFiles',
	'serialRuns',
	'workerTimeout',
]
const queryKeys = new Set<string>(baseKeys)
const checkKeys = new Set<string>(
	baseKeys.concat(extraKeys).map((key: string): string => `${configRoot}.${key}`)
)
const invalid: { [key: string]: unknown } = {
	/* eslint unicorn/prevent-abbreviations: "off" */
	cwd: 42,
	configs: [],
	env: [],
	serialRuns: 'true',
	nodePath: false,
	nodeArgv: {},
	debuggerPort: 70000,
	debuggerSkipFiles: null,
	timeout: 500,
}

const logger = (..._: []): void => {}

const fakeLog: Log = {
	enabled: false,
	info: logger,
	warn: logger,
	error: logger,
	debug: logger,
}

test('construct default', (t): void => {
	const query = t.context.sandbox.spy((_: string): undefined => undefined)
	const config = new Config<extraKey>(fsPath, query, fakeLog, extraKeys, nodePath)
	const c = config.current
	t.deepEqual(c, defaultConfig)
	for (const key of queryKeys) {
		t.true(query.calledWith(key))
	}
})

function queryDefaults<T>(key: string): T | undefined {
	const alias = aliases[key]
	if (alias) {
		return defaultConfig[alias] as T | undefined
	} else {
		return defaultConfig[key] as T | undefined
	}
}

test('construct with defaults', (t): void => {
	const config = new Config<extraKey>(fsPath, queryDefaults, fakeLog, extraKeys, nodePath)
	const c = config.current
	t.deepEqual(c, defaultConfig)
})

function queryInvalid<T>(key: string): T | undefined {
	return invalid[key] as T | undefined
}

test('construct with invalid', (t): void => {
	const config = new Config<extraKey>(fsPath, queryInvalid, fakeLog, extraKeys, nodePath)
	const c = config.current
	t.deepEqual(c, defaultConfig)
})

function invalidNodeQuery(key: 'nodePath'): string | undefined
function invalidNodeQuery<T>(_: string): undefined
function invalidNodeQuery<T>(key: string): T | string | undefined {
	if (key === 'nodePath') {
		return ''
	} else {
		return undefined
	}
}

test('construct invalid node', (t): void => {
	const config = new Config<extraKey>(fsPath, invalidNodeQuery, fakeLog, extraKeys, nodePath)
	const c = config.current
	t.deepEqual(c, defaultConfig)
})

function environmentQuery(key: 'env'): { [x: string]: unknown } | undefined
function environmentQuery<T>(_: string): undefined
function environmentQuery<T>(key: string): T | { [x: string]: unknown } | undefined {
	if (key === 'env') {
		return {
			a: '',
			b: 'true',
			c: 'false',
			d: '42',
			x: 'hello',
			y: true,
			z: 42,
			f: false,
			omit: null,
		}
	} else {
		return undefined
	}
}

test('construct with environment', (t): void => {
	const config = new Config<extraKey>(fsPath, environmentQuery, fakeLog, extraKeys, nodePath)
	const { environment } = config.current
	t.deepEqual(environment, {
		a: '',
		b: 'true',
		c: 'false',
		d: '42',
		x: 'hello',
	})
})

/* eslint @typescript-eslint/no-explicit-any: "off" */
function configsQuery(key: 'configs'): any[] | undefined
function configsQuery<T>(_: string): undefined
function configsQuery<T>(key: string): T | any[] | undefined {
	if (key === 'configs') {
		return [
			{
				file: 'ava.coverage.js',
			},
			{
				serial: true,
				debuggerSkipFiles: ['events.js', null],
			},
			42,
		] as any[]
	} else {
		return undefined
	}
}

test('construct with configs', (t): void => {
	const config = new Config<extraKey>(fsPath, configsQuery, fakeLog, extraKeys, nodePath)
	const { configs } = config.current
	t.deepEqual(configs, [
		{
			file: 'ava.coverage.js',
			serial: false,
			debuggerSkipFiles: [],
		},
		{
			file: 'ava.config.js',
			serial: true,
			debuggerSkipFiles: ['events.js'],
		},
		{
			file: 'ava.config.js',
			serial: false,
			debuggerSkipFiles: [],
		},
	])
})

test('update extra', (t): void => {
	const spy = t.context.sandbox.spy
	const config = new Config<extraKey>(fsPath, queryDefaults, fakeLog, extraKeys, nodePath)
	const c = config.current
	t.deepEqual(c, defaultConfig)
	const z = `${configRoot}.logpanel`
	const check = spy((key: string): boolean => key === z)
	const x = config.update(check, queryDefaults)
	for (const key of checkKeys) {
		t.true(check.calledWith(key))
	}
	t.is(x.size, 1)
	for (const key in defaultConfig) {
		t.false(x.has(key as ConfigKey))
	}
	t.true(x.has('logpanel'))
	t.false(x.has('logfile'))
	t.deepEqual(config.current, c)
})

test('update main', (t): void => {
	const spy = t.context.sandbox.spy
	const config = new Config<extraKey>(fsPath, queryDefaults, fakeLog, extraKeys, nodePath)
	const c = config.current
	t.deepEqual(c, defaultConfig)
	const check = spy(
		(key: string): boolean => !(key.endsWith('logpanel') || key.endsWith('logfile'))
	)
	const x = config.update(check, queryInvalid)
	for (const key of checkKeys) {
		t.true(check.calledWith(key))
	}
	t.is(x.size, checkKeys.size - extraKeys.length)
	for (const key in defaultConfig) {
		t.true(x.has(key as ConfigKey))
	}
	t.deepEqual(config.current, c)
})

function queryAlternate<T>(key: string): T | undefined {
	const alias = aliases[key]
	if (alias) {
		return alternateConfig[alias] as T | undefined
	} else {
		return alternateConfig[key] as T | undefined
	}
}

test('update both', (t): void => {
	const spy = t.context.sandbox.spy
	const config = new Config<extraKey>(fsPath, queryDefaults, fakeLog, extraKeys, nodePath)
	const c = config.current
	t.deepEqual(c, defaultConfig)
	const check = spy(
		(key: string): boolean => !(key.endsWith('logfile') || key.endsWith('debuggerSkipFiles'))
	)
	const x = config.update(check, queryAlternate)
	for (const key of checkKeys) {
		t.true(check.calledWith(key))
	}
	t.is(x.size, checkKeys.size - 2)
	for (const key in defaultConfig) {
		if (key !== 'debuggerSkipFiles') {
			t.true(x.has(key as ConfigKey))
		} else {
			t.false(x.has(key))
		}
	}
	t.true(x.has('logpanel'))
	t.false(x.has('logfile'))
	t.deepEqual(config.current, { ...alternateConfig, debuggerSkipFiles: [] })
})
