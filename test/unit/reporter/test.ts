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
	/**
	 * @summary Isolated sinon sandbox.
	 */
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

test('TestReporter begin and end log', async (t): Promise<void> => {
	const l = t.context.sandbox.spy()
	const emit = new Emitter()
	const status = new Status([], null)
	const r = new TestReporter(emit, 0, l)
	r.startRun({
		...basePlan,
		status,
	})
	r.endRun()
	r.endRun()
	t.is(l.callCount, 2)
})
