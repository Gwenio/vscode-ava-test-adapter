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
import ow from 'ow'
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
} from './messages'

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

/** Filter for test config IDs. */
const configID = ow.string.matches(/c([0-9a-f]+)/)

/** Filter for test file IDs. */
const fileID = ow.string.matches(/f([0-9a-f]+)/)

/** Filter for test case IDs. */
const testID = ow.string.matches(/t([0-9a-f]+)/)

/** Throws an error if not called with a valid logging message. */
const logFilter = ow.create(
	ow.object.partialShape({
		enable: ow.boolean,
	})
)

/**
 * Checks for an IPC Logging Message.
 * @param x Object to type check.
 */
export function isLogging(x: Message | Logging): x is Logging {
	logFilter(x)
	return true
}

/** Throws an error if not called with a valid load message. */
const loadFilter = ow.create(
	ow.object.partialShape({
		file: ow.string.nonEmpty,
	})
)

/**
 * Checks for an IPC Load Message.
 * @param x Object to type check.
 */
export function isLoad(x: Message | Load): x is Load {
	loadFilter(x)
	return true
}

/** Throws an error if not called with a valid drop message. */
const dropFilter = ow.create(
	ow.object.partialShape({
		id: ow.any(ow.undefined, configID),
	})
)

/**
 * Checks for an IPC Drop Message.
 * @param x Object to type check.
 */
export function isDrop(x: Message | Drop): x is Drop {
	dropFilter(x)
	return true
}

/** Throws an error if not called with a valid prefix message. */
const prefixFilter = ow.create(
	ow.object.partialShape({
		id: configID,
		file: ow.string.nonEmpty,
		prefix: ow.string,
	})
)

/**
 * Checks for an IPC Prefix Message.
 * @param x Object to type check.
 */
export function isPrefix(x: Message | Prefix): x is Prefix {
	prefixFilter(x)
	return true
}

/** Throws an error if not called with a valid test file message. */
const fileFilter = ow.create(
	ow.object.partialShape({
		id: fileID,
		config: configID,
		file: ow.string.nonEmpty,
	})
)

/**
 * Checks for an IPC TestFile Message.
 * @param x Object to type check.
 */
export function isTestFile(x: Message | TestFile): x is TestFile {
	fileFilter(x)
	return true
}

/** Throws an error if not called with a valid test case message. */
const caseFilter = ow.create(
	ow.object.partialShape({
		id: testID,
		file: fileID,
		test: ow.string,
	})
)

/**
 * Checks for an IPC TestCase Message.
 * @param x Object to type check.
 */
export function isTestCase(x: Message | TestCase): x is TestCase {
	caseFilter(x)
	return true
}

const runList = ow.array.nonEmpty.ofType(ow.string.matches(/(root)|([cft]([0-9a-f]+))/))

/** Throws an error if not called with a valid run message. */
const runFilter = ow.create(
	ow.object.partialShape({
		run: runList,
	})
)

/**
 * Checks for an IPC Run Message.
 * @param x Object to type check.
 */
export function isRun(x: Message | Run): x is Run {
	runFilter(x)
	return true
}

/** Throws an error if not called with a valid done message. */
const doneFilter = ow.create(
	ow.object.partialShape({
		file: ow.string.matches(/[cf]([0-9a-f]+)/),
	})
)

/**
 * Checks for an IPC Done Message.
 * @param x Object to type check.
 */
export function isDone(x: Message | Done): x is Done {
	doneFilter(x)
	return true
}

/** Throws an error if not called with a valid result message. */
const resultFilter = ow.create(
	ow.object.partialShape({
		test: testID,
		state: ow.string.oneOf(['running', 'passed', 'failed', 'skipped', 'errored']),
	})
)

/**
 * Checks for an IPC Result Message.
 * @param x Object to type check.
 */
export function isResult(x: Message | Result): x is Result {
	resultFilter(x)
	return true
}

/** OW shape for a network port number. */
const portNumber = ow.number.greaterThanOrEqual(0).lessThanOrEqual(65535)

/** Throws an error if not called with a valid debug message. */
const debugFilter = ow.create(
	ow.object.partialShape({
		port: portNumber,
		run: runList,
		serial: ow.object.partialShape({
			x: ow.boolean,
			list: ow.array.ofType(configID),
		}),
	})
)

/**
 * Checks for an IPC Debug Message.
 * @param x Object to type check.
 */
export function isDebug(x: Message | Debug): x is Debug {
	debugFilter(x)
	return true
}

/** Throws an error if not called with a valid ready message. */
const readyFilter = ow.create(
	ow.object.partialShape({
		port: portNumber,
		config: configID,
	})
)

/**
 * Checks for an IPC Ready Message.
 * @param x Object to type check.
 */
export function isReady(x: Message | Ready): x is Ready {
	readyFilter(x)
	return true
}
