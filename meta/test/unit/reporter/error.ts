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
import { ErrorReporter } from '~worker/reporter'

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
	filePathPrefix: '',
	files: [],
	matching: true,
	previousFailures: 0,
	runOnlyExclusive: true,
	runVector: 0,
}

test('begin and end log', async (t): Promise<void> => {
	const start = t.context.sandbox.spy()
	const stop = t.context.sandbox.spy()
	const s1 = new Status([], null)
	const s2 = new Status([], null)
	const r = new ErrorReporter({
		startRun: start,
		endRun: stop,
	})
	r.startRun({
		...basePlan,
		status: s1,
	})
	r.startRun({
		...basePlan,
		status: s2,
	})
	r.endRun()
	r.endRun()
	t.is(start.callCount, 2)
	t.is(stop.callCount, 2)
})
