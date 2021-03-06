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
import { DebugReporter } from '~worker/reporter'

interface Context {
	/** Isolated sinon sandbox.  */
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
	filePathPrefix: '',
	files: [],
	matching: true,
	previousFailures: 0,
	runOnlyExclusive: true,
	runVector: 0,
}

test.serial(
	'begin and end log',
	async (t): Promise<void> => {
		const spy = t.context.sandbox.spy
		const l1 = spy((_: string): void => {})
		const l2 = spy((_: string): void => {})
		const ready = spy((_: number): void => {})
		const s1 = new Status([], null)
		const s2 = new Status([], null)
		const r1 = new DebugReporter(ready, 9229, l1)
		const r2 = new DebugReporter(ready, 9229, l2)
		r1.startRun({
			...basePlan,
			status: s1,
		})
		t.throws((): void => {
			r2.startRun({
				...basePlan,
				status: s2,
			})
		})
		r1.endRun()
		r2.endRun()
		t.is(l1.callCount, 2)
		t.true(l1.calledWith('Begin Debug Run.'))
		t.true(l1.calledWith('Debug Run Complete.'))
		t.is(l2.callCount, 0)
		t.is(ready.callCount, 1)
		t.true(ready.calledWith(9229))
	}
)

test.serial(
	'select inspect port',
	async (t): Promise<void> => {
		const ready = t.context.sandbox.spy((_: number): void => {})
		const status = new Status([], null)
		const r = new DebugReporter(ready, 9229)
		await t.notThrowsAsync(
			async (): Promise<void> => {
				const port = await r.selectPort()
				r.startRun({
					...basePlan,
					status,
				})
				r.endRun()
				t.is(ready.callCount, 1)
				t.true(ready.calledWith(port))
			}
		)
	}
)
