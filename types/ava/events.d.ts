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

/* eslint-disable */ // VSCode ESLint plugin does not respect .eslintignore

export interface FileStats {
	declaredTests: number
	failedHooks: number
	failedTests: number
	internalErrors: number
	remainingTests: number
	passedKnownFailingTests: number
	passedTests: number
	selectedTests: number
	skippedTests: number
	todoTests: number
	uncaughtExceptions: number
	unhandledRejections: number
}

export interface TestStats {
	byFile: Map<string, Stats>
	failedWorkers: number
	files: number
	parallelRuns: null | number
	finishedWorkers: number
	timeouts: number
	uncaughtExceptions: number
	unhandledRejections: number
}

export namespace Events {
	interface DeclareTest {
		type: 'declared-test'
		title: string
		knownFailing: boolean
		todo: boolean
		testFile: string
	}
	interface SelectTest {
		type: 'selected-test'
		title: string
		knownFailing: boolean
		skip: boolean
		todo: boolean
		testFile: string
	}

	interface TestPassed {
		type: 'test-passed'
		title: string
		duration: number
		knownFailing: boolean
		logs: []
		testFile: string
	}

	interface ErrorSource {
		isDependency: boolean
		isWithinProject: boolean
		file: string
		line: number
	}

	interface ErrorInfo {
		avaAssertionError: boolean
		nonErrorObject: boolean
		source: ErrorSource
		stack: string
		improperUsage: boolean
		message: string
		name: string
		statements: []
		values: {
			label: string
			formatted: string
		}[]
		summary: string
	}

	interface TestFailed {
		type: 'test-failed'
		title: string
		duration: number
		knownFailing: boolean
		err: ErrorInfo
		logs: []
		testFile: string
	}

	interface HookFinished {
		type: 'hook-finished'
		title: string
		duration: number
		logs: []
		testFile: string
	}

	interface WorkerFinished {
		type: 'worker-finished'
		forcedExit: boolean
		testFile: string
	}

	interface WorkerFailed {
		type: 'worker-failed'
		testFile: string
	}

	interface Stats {
		type: 'stats'
		stats: TestStats
	}

	interface Interrrupt {
		type: 'interrupt'
	}

	interface Output {
		type: 'worker-stderr' | 'worker-stdout'
		chunk: string | Uint8Array
	}
}

export type Event =
	| Events.DeclareTest
	| Events.HookFinished
	| Events.SelectTest
	| Events.Stats
	| Events.TestPassed
	| Events.TestFailed
	| Events.WorkerFinished
	| Events.WorkerFailed
	| Events.Output
	| Events.Interrrupt
