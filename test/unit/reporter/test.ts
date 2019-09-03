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

import Emitter from 'events'
import anyTest, { TestInterface } from 'ava'
import sinon, { SinonSandbox } from 'sinon'
import Status from 'ava/lib/run-status'
import { TestReporter } from '../../../src/reporter'

interface Context {
	/** Isolated sinon sandbox. */
	sandbox: SinonSandbox
	/** Test Status Tracker. */
	status: Status
}

const test = anyTest as TestInterface<Context>

test.beforeEach(
	async (t): Promise<void> => {
		t.context.sandbox = sinon.createSandbox()
		t.context.status = new Status([], null)
	}
)

test.afterEach(
	async (t): Promise<void> => {
		t.context.status.clearListeners()
	}
)

const basePlan = {
	clearLogOnNextRun: false,
	failFastEnabled: false,
	filePathPrefix: 'dir/',
	files: ['dir/x.js', 'dir/w/z.js', 'dir/y.js'],
	matching: true,
	previousFailures: 0,
	runOnlyExclusive: true,
	runVector: 0,
}
const prefixSize = basePlan.filePathPrefix.length
const expectedResults: {
	file: string
	state: 'skipped' | 'passed' | 'failed'
	test: string
}[] = []

function select(f: number, title: string, skip: boolean): AVA.Events.SelectTest {
	const file = basePlan.files[f]
	if (skip) {
		expectedResults.push({
			file,
			state: 'skipped',
			test: title,
		})
	}
	return {
		type: 'selected-test',
		testFile: file,
		title,
		todo: false,
		skip,
		knownFailing: false,
	}
}

type TestResult = AVA.Events.TestFailed | AVA.Events.TestPassed

function result(f: number, title: string, pass: boolean): TestResult {
	const file = basePlan.files[f]
	if (pass) {
		expectedResults.push({
			file,
			state: 'passed',
			test: title,
		})
		return {
			type: 'test-passed',
			title,
			testFile: file,
			duration: 1,
			knownFailing: false,
			logs: [],
		}
	} else {
		expectedResults.push({
			file,
			state: 'failed',
			test: title,
		})
		return {
			type: 'test-failed',
			title,
			testFile: file,
			duration: 1,
			knownFailing: false,
			logs: [],
			/* eslint unicorn/prevent-abbreviations: "off" */
			err: {
				avaAssertionError: true,
				nonErrorObject: false,
				source: null,
				statements: [],
				values: [],
				summary: 'failed',
			},
		}
	}
}

function finish(f: number): AVA.Events.WorkerFinished {
	return {
		type: 'worker-finished',
		forcedExit: false,
		testFile: basePlan.files[f],
	}
}

const sampleEvents: AVA.Event[] = [
	select(0, 'p0', false),
	select(1, 's0', true),
	select(0, 'f0', false),
	{
		type: 'worker-failed',
		nonZeroExitCode: 1,
		testFile: basePlan.files[2],
	},
	select(0, 's0', false),
	select(1, 'f0', true),
	select(1, 's1', true),
	select(1, 'p0', false),
	select(0, 'p1', false),
	result(0, 'p0', true),
	result(0, 'f0', false),
	result(1, 'f0', false),
	result(1, 'p0', true),
	finish(1),
	result(0, 'p1', true),
	finish(0),
]

function mockTests(status: Status): Promise<void> {
	const done = new Promise<void>((resolve): void => {
		let count = 0
		status.on('stateChange', (_): void => {
			count += 1
			if (count >= sampleEvents.length) {
				setImmediate(resolve)
			}
		})
	})
	for (const event of sampleEvents) {
		status.emitSerial('stateChange', event)
	}
	return done
}

test('begin and end log', async (t): Promise<void> => {
	const l = t.context.sandbox.spy()
	let end = 0
	const emit = new Emitter().on('end', (): void => {
		end += 1
	})
	const status = t.context.status
	const r1 = new TestReporter(emit, prefixSize, l)
	const r2 = new TestReporter(emit, prefixSize)
	r1.startRun({
		...basePlan,
		status,
	})
	t.notThrows((): void => {
		r2.startRun({
			...basePlan,
			status,
		})
		r2.endRun()
	})
	r1.endRun()
	r1.endRun()
	t.is(l.callCount, 2)
	t.true(l.firstCall.calledWith('Begin Test Run.'))
	t.true(l.lastCall.calledWith('Test Run Complete.'))
	t.is(end, 2)
})

test('sample results', async (t): Promise<void> => {
	const status = t.context.status
	const spy = t.context.sandbox.spy
	const result = spy()
	const done = spy()
	let end = false
	const emit = new Emitter()
		.once('end', (): void => {
			end = true
		})
		.on('result', result)
		.on('done', done)
	const r = new TestReporter(emit, 0)
	r.startRun({
		...basePlan,
		status,
	})
	await mockTests(status)
	r.endRun()
	t.true(end)
	t.is(done.callCount, 3)
	t.log(result.getCalls())
	for (const f of basePlan.files) {
		t.true(done.calledWith(f), `done not called with ${f}`)
	}
	t.is(result.callCount, 8)
	for (const x of expectedResults) {
		t.true(result.calledWith(x), `Expected result ${JSON.stringify(x)}`)
	}
})
