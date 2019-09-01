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

import anyTest, { TestInterface } from 'ava'
import sinon, { SinonSandbox } from 'sinon'
import Status from 'ava/lib/run-status'
import { LoadReporter } from '../../../src/reporter'

interface Context {
	/** Isolated sinon sandbox. */
	sandbox: SinonSandbox
}

const test = anyTest as TestInterface<Context>

// Setup isolated sandbox
test.beforeEach(
	async (t): Promise<void> => {
		t.context.sandbox = sinon.createSandbox()
	}
)

const basePlan = {
	clearLogOnNextRun: false,
	failFastEnabled: false,
	filePathPrefix: 'dir/',
	files: ['dir/x.js', 'dir/y.js', 'dir/w/z.js'],
	matching: true,
	previousFailures: 0,
	runOnlyExclusive: true,
	runVector: 0,
}
const testTitles = ['a0', 'a1', 'a2', 'a10', 'b1', 'b2', 'b3', 'c0', 'c2']
const testCount = testTitles.length * basePlan.files.length
const prefixSize = basePlan.filePathPrefix.length

function mockConfig(status: Status): void {
	const x = (testFile: string, title: string): void => {
		status.emitSerial('stateChange', {
			type: 'declared-test',
			testFile,
			title,
			knownFailing: false,
			todo: false,
		})
	}
	for (const f of basePlan.files) {
		for (const t of testTitles) {
			x(f, t)
		}
	}
}

function waitTests(status: Status): Promise<void> {
	return new Promise<void>((resolve): void => {
		let count = 0
		status.on('stateChange', (_): void => {
			count += 1
			if (count >= testCount) {
				setImmediate(resolve)
			}
		})
	})
}

test('begin and end log', async (t): Promise<void> => {
	const l = t.context.sandbox.spy()
	const status = new Status([], null)
	const r1 = new LoadReporter([], l)
	const r2 = new LoadReporter([])
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
	t.true(l.firstCall.calledWith('Begin Loading.'))
	t.true(l.lastCall.calledWith('Loading Complete.'))
})

test('no filter', async (t): Promise<void> => {
	const status = new Status([], null)
	try {
		const r = new LoadReporter([])
		r.startRun({
			...basePlan,
			status,
		})
		const done = waitTests(status)
		mockConfig(status)
		await done
		r.endRun()
		t.deepEqual(r.report, {
			prefix: basePlan.filePathPrefix,
			info: basePlan.files.map((f): object => {
				return {
					file: f.slice(prefixSize),
					tests: testTitles,
				}
			}),
		})
	} finally {
		status.clearListeners()
	}
})

test('with filter', async (t): Promise<void> => {
	const status = new Status([], null)
	try {
		const r = new LoadReporter(['a*', '!a1', 'b2', 'c1'])
		r.startRun({
			...basePlan,
			status,
		})
		const done = waitTests(status)
		mockConfig(status)
		await done
		r.endRun()
		const titles = ['a0', 'a2', 'a10', 'b2']
		t.deepEqual(r.report, {
			prefix: basePlan.filePathPrefix,
			info: basePlan.files.map((f): object => {
				return {
					file: f.slice(prefixSize),
					tests: titles,
				}
			}),
		})
	} finally {
		status.clearListeners()
	}
})
