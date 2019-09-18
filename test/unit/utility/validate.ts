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

import test from 'ava'
import {
	isMessage,
	isLogging,
	isLoad,
	isDrop,
	isPrefix,
	isTestFile,
	isTestCase,
	isRun,
	isDone,
	isResult,
	isDebug,
	isReady,
} from '../../../src/utility/validate'
import { TestFile, Prefix, Ready, Debug } from '../../../src/ipc'

test('isMessage', (t): void => {
	t.true(isMessage({ type: 'log' }))
	t.true(isMessage({ type: '' }))
	t.false(isMessage(undefined))
	t.false(isMessage(true))
	t.false(isMessage({}))
	t.false(isMessage({ x: 'log' }))
	t.false(isMessage({ type: true }))
	t.false(isMessage({ type: 1 }))
	t.false(isMessage({ type: [] }))
})

test('isLogging', (t): void => {
	t.true(
		isLogging({
			type: 'log',
			enable: true,
		})
	)
	t.true(
		isLogging({
			type: 'log',
			enable: false,
		})
	)
})

test('isLoad', (t): void => {
	t.true(
		isLoad({
			type: 'load',
			file: 'ava.config.js',
		})
	)
	t.throws((): void => {
		isLoad({
			type: 'load',
			file: '',
		})
	})
})

test('isDrop', (t): void => {
	t.true(
		isDrop({
			type: 'drop',
			id: undefined,
		})
	)
	t.true(
		isDrop({
			type: 'drop',
			id: 'c0',
		})
	)
	t.throws((): void => {
		debugger
		isDrop({
			type: 'drop',
			id: 'c',
		})
	})
})

test('isPrefix', (t): void => {
	const base: Prefix = {
		type: 'prefix',
		id: 'c0',
		file: 'ava.config.js',
		prefix: '',
	}
	t.true(isPrefix(base))
	t.throws((): void => {
		isPrefix({
			...base,
			id: 'c',
		})
	})
	t.throws((): void => {
		isPrefix({
			...base,
			file: '',
		})
	})
})

test('isTestFile', (t): void => {
	const base: TestFile = {
		type: 'file',
		id: 'f0',
		config: 'c0',
		file: 't.js',
	}
	t.true(isTestFile(base))
	t.throws((): void => {
		isTestFile({
			...base,
			id: 'f',
		})
	})
	t.throws((): void => {
		isTestFile({
			...base,
			config: 'f0',
		})
	})
	t.throws((): void => {
		isTestFile({
			...base,
			config: 't0',
		})
	})
	t.throws((): void => {
		isTestFile({
			...base,
			config: 'c',
		})
	})
	t.throws((): void => {
		isTestFile({
			...base,
			file: '',
		})
	})
})

test('isTestCase', (t): void => {
	t.true(
		isTestCase({
			type: 'case',
			id: 't0',
			file: 'f0',
			test: 'a',
		})
	)
})

test('isRun', (t): void => {
	t.true(
		isRun({
			type: 'run',
			run: ['root'],
		})
	)
})

test('isDone', (t): void => {
	t.true(
		isDone({
			type: 'done',
			file: 'c0',
		})
	)
	t.true(
		isDone({
			type: 'done',
			file: 'f0',
		})
	)
})

test('isResult', (t): void => {
	t.true(
		isResult({
			type: 'result',
			test: 't0',
			state: 'passed',
		})
	)
	t.true(
		isResult({
			type: 'result',
			test: 't0',
			state: 'failed',
		})
	)
	t.true(
		isResult({
			type: 'result',
			test: 't0',
			state: 'skipped',
		})
	)
})

test('isDebug', (t): void => {
	const base: Debug = {
		type: 'debug',
		port: 9229,
		run: ['root'],
		serial: {
			x: true,
			list: [],
		},
	}
	t.true(isDebug(base))
	t.true(
		isDebug({
			...base,
			serial: {
				x: false,
				list: [],
			},
		})
	)
	t.true(
		isDebug({
			...base,
			serial: {
				x: true,
				list: ['c0'],
			},
		})
	)
	t.true(
		isDebug({
			...base,
			serial: {
				x: false,
				list: ['c0'],
			},
		})
	)
})

test('isReady', (t): void => {
	const base: Ready = {
		type: 'ready',
		config: 'c0',
		port: 9229,
	}
	t.true(isReady(base))
	t.throws((): void => {
		isReady({
			...base,
			port: 70000,
		})
	})
	t.throws((): void => {
		isReady({
			...base,
			config: 'c',
		})
	})
	t.throws((): void => {
		isReady({
			...base,
			config: 'f0',
		})
	})
	t.throws((): void => {
		isReady({
			...base,
			config: 't0',
		})
	})
	t.throws((): void => {
		isReady({
			...base,
			config: 'root',
		})
	})
})
