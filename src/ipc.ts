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

/** The base type for IPC messages. */
interface Base<T extends string> {
	/** The message type. */
	type: T
}

/** Message to control the worker's logging. */
export interface Logging extends Base<'log'> {
	/** Whether to enable or disable logging. */
	enable: boolean
}

/** Message to load a configuration file. */
export interface Load extends Base<'load'> {
	/** The configuration file name relative to the worker's CWD. */
	file: string
}

/** Message to drop a loaded configuration. */
export interface Drop extends Base<'drop'> {
	/** The ID of the configuration to drop or undefined to drop all. */
	id?: string
}

/** Message with information on a newly loaded configuration. */
export interface Prefix extends Base<'prefix'> {
	/** The ID assigned to the configuration. */
	id: string
	/** The configuration file name relative to the worker's CWD. */
	file: string
	/** The common path prefix of the configuration's test files. */
	prefix: string
}

/** Message with information on a test file. */
export interface TestFile extends Base<'file'> {
	/** The ID assigned to the test file. */
	id: string
	/** The ID of the configuration the test file belongs to. */
	config: string
	/** The test file name relative to the common prefix. */
	file: string
}

/** Message with information on a test case. */
export interface TestCase extends Base<'case'> {
	/** The ID assigned to the configuration. */
	id: string
	/** The ID of the test file containing the test case. */
	file: string
	/** The test's title. */
	test: string
}

/** Message that triggers a test run. */
export interface Run extends Base<'run'> {
	/** Array of IDs to include in the run. */
	run: string[]
}

/** Message to stop an active run. */
export type Stop = Base<'stop'>

/** Message containing the result of a test. */
export interface Result extends Base<'result'> {
	/** The ID of the test. */
	test: string
	/** The test state for the adapter. */
	state: 'running' | 'passed' | 'failed' | 'skipped' | 'errored'
}

/** Message signalling that a configuration or test file is complete. */
export interface Done extends Base<'done'> {
	/** The configuration or test file ID. */
	file: string
}

/** Message triggering a debugging run of tests. */
export interface Debug extends Base<'debug'> {
	/** The preferred inspect port. */
	port: number
	/** Contains information of which configurations to force to be serial. */
	serial: {
		/** A configuration is to be debugged serially if x !== list.includes(id). */
		x: boolean
		/** Array of configuration IDs. */
		list: string[]
	}
	/** Array of IDs to include in the run. */
	run: string[]
}

export interface Ready extends Base<'ready'> {
	/** The configuration being debugged. */
	config: string
	/** The inspect port to use. */
	port: number
}

/** Messages that trigger actions in the worker. */
export type Action = Load | Drop | Run | Stop | Debug

/** Messages sent by the parent. */
export type Parent = Action | Logging

/** Messages for building the TestTree. */
export type Tree = Prefix | TestFile | TestCase

/** Test run event messages. */
export type Event = Result | Done

/** Messages sent by the child. */
export type Child = Tree | Event | Ready
