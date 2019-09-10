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

import is from '@sindresorhus/is'
import {
	Prefix,
	Done,
	Drop,
	Ready,
	Load,
	Logging,
	TestFile,
	TestCase,
	Run,
	Stop,
	Result,
	Debug,
} from '../ipc'

/** Maybe a message. */
type Maybe<T> = { [P in keyof T]?: T[P] } & { readonly type: string }

/** Is an IPC message. */
type Message = Maybe<Logging> &
	Maybe<Load> &
	Maybe<Drop> &
	Maybe<Prefix> &
	Maybe<TestFile> &
	Maybe<TestCase> &
	Maybe<Run> &
	Stop &
	Maybe<Done> &
	Maybe<Result> &
	Maybe<Debug> &
	Maybe<Ready> & {
		readonly type: string
		[key: string]: unknown
	}

/**
 * Checks for an IPC Message.
 * @param x Object to type check.
 */
export function isMessage(x: unknown): x is Message {
	return is.plainObject(x) && is.string(x.type)
}

/**
 * Checks for a Config ID.
 * @param x Value to check.
 */
function isConfigID(x: unknown): x is string {
	return is.nonEmptyString(x) && x.startsWith('c')
}

/**
 * Checks for a Test File ID.
 * @param x Value to check.
 */
function isFileID(x: unknown): x is string {
	return is.nonEmptyString(x) && x.startsWith('f')
}

/**
 * Checks for a Test Case ID.
 * @param x Value to check.
 */
function isTestID(x: unknown): x is string {
	return is.nonEmptyString(x) && x.startsWith('t')
}

/**
 * Checks for an IPC Logging Message.
 * @param x Object to type check.
 */
export function isLogging(x: Message | Logging): x is Logging {
	const { enable } = x
	return is.boolean(enable)
}

/**
 * Checks for an IPC Load Message.
 * @param x Object to type check.
 */
export function isLoad(x: Message | Load): x is Load {
	const { file } = x
	return is.string(file)
}

/**
 * Checks for an IPC Drop Message.
 * @param x Object to type check.
 */
export function isDrop(x: Message | Drop): x is Drop {
	const { id } = x
	return is.falsy(id) || isConfigID(id)
}

/**
 * Checks for an IPC Prefix Message.
 * @param x Object to type check.
 */
export function isPrefix(x: Message | Prefix): x is Prefix {
	const { id, file, prefix } = x
	return isConfigID(id) && is.nonEmptyString(file) && is.string(prefix)
}

/**
 * Checks for an IPC TestFile Message.
 * @param x Object to type check.
 */
export function isTestFile(x: Message | TestFile): x is TestFile {
	const { id, config, file } = x
	return isFileID(id) && is.nonEmptyString(file) && isConfigID(config)
}

/**
 * Checks for an IPC TestCase Message.
 * @param x Object to type check.
 */
export function isTestCase(x: Message | TestCase): x is TestCase {
	const { id, file, test } = x
	return isTestID(id) && is.nonEmptyString(test) && isFileID(file)
}

/**
 * Checks for an IPC Run Message.
 * @param x Object to type check.
 */
export function isRun(x: Message | Run): x is Run {
	const { run } = x
	return is.nonEmptyArray(run) && run.every(is.nonEmptyString)
}

/**
 * Checks for an IPC Done Message.
 * @param x Object to type check.
 */
export function isDone(x: Message | Done): x is Done {
	const { file } = x
	return is.nonEmptyString(file)
}

/** Set of valid Result states. */
const states = new Set<string>(['running', 'passed', 'failed', 'skipped', 'errored'])

/**
 * Checks for an IPC Result Message.
 * @param x Object to type check.
 */
export function isResult(x: Message | Result): x is Result {
	const { test, state } = x
	return isTestID(test) && is.string(state) && states.has(state)
}

/**
 * Checks for an IPC Debug Message.
 * @param x Object to type check.
 */
export function isDebug(x: Message | Debug): x is Debug {
	const { port, run, serial } = x
	return (
		is.number(port) &&
		is.nonEmptyArray(run) &&
		run.every(is.nonEmptyString) &&
		is.plainObject(serial) &&
		is.boolean(serial.x) &&
		is.array(serial.list) &&
		serial.list.every(isConfigID)
	)
}

/**
 * Checks for an IPC Ready Message.
 * @param x Object to type check.
 */
export function isReady(x: Message | Ready): x is Ready {
	const { config, port } = x
	return is.number(port) && isConfigID(config)
}
