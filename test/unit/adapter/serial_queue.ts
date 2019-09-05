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
import { SerialQueue } from '../../../src/adapter/queue'

interface Context {
	/** Isolated sinon sandbox. */
	sandbox: SinonSandbox
}

const test = anyTest as TestInterface<Context>

test.beforeEach(
	async (t): Promise<void> => {
		t.context.sandbox = sinon.createSandbox()
	}
)

test('can run a task', async (t): Promise<void> => {
	const q = new SerialQueue()
	new Promise<void>((resolve, reject): void => {
		const t = setTimeout(reject, 1000)
		q.add((): void => {
			clearTimeout(t)
			resolve()
		})
	}).then(
		(): void => {
			t.pass()
		},
		(): void => {
			t.fail()
		}
	)
})

test('runs tasks in order', async (t): Promise<void> => {
	const q = new SerialQueue()
	const spy = t.context.sandbox.spy
	let count = 0
	const l = [
		spy((): boolean => count === 0),
		spy((): boolean => count === 1),
		spy((): boolean => count === 2),
	]
	await new Promise<void>((resolve): void => {
		let active = true
		const done = (): void => {
			/* istanbul ignore else */
			if (active) {
				active = false
				resolve()
			}
		}
		const t = setTimeout(done, 1000)
		for (const x of l) {
			q.add((): void => {
				x()
				count += 1
				if (count < l.length) {
					t.refresh()
				} else {
					clearTimeout(t)
					done()
				}
			})
		}
	})
	for (const x of l) {
		t.is(x.callCount, 1)
		t.true(x.alwaysReturned(true))
	}
})
