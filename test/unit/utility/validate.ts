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

test('isMessage', async (t): Promise<void> => {
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

test('isLogging', async (t): Promise<void> => {
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

test('isLoad', async (t): Promise<void> => {
	t.true(
		isLoad({
			type: 'load',
			file: 'ava.config.js',
		})
	)
})

test('isDrop', async (t): Promise<void> => {
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
})

test('isPrefix', async (t): Promise<void> => {
	t.true(
		isPrefix({
			type: 'prefix',
			id: 'c0',
			file: 'ava.config.js',
			prefix: '',
		})
	)
})

test('isTestFile', async (t): Promise<void> => {
	t.true(
		isTestFile({
			type: 'file',
			id: 'f0',
			config: 'c0',
			file: 't.js',
		})
	)
})

test('isTestCase', async (t): Promise<void> => {
	t.true(
		isTestCase({
			type: 'case',
			id: 't0',
			file: 'f0',
			test: 'a',
		})
	)
})

test('isRun', async (t): Promise<void> => {
	t.true(
		isRun({
			type: 'run',
			run: ['root'],
		})
	)
})

test('isDone', async (t): Promise<void> => {
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

test('isResult', async (t): Promise<void> => {
	t.true(
		isResult({
			type: 'result',
			test: 't0',
			state: 'passed',
		})
	)
})

test('isDebug', async (t): Promise<void> => {
	t.true(
		isDebug({
			type: 'debug',
			port: 9229,
			run: ['root'],
			serial: {
				x: true,
				list: [],
			},
		})
	)
})

test('isReady', async (t): Promise<void> => {
	t.true(
		isReady({
			type: 'ready',
			config: 'c0',
			port: 9229,
		})
	)
})
