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

import Emitter from 'emittery'
import anyTest, { TestInterface } from 'ava'
import sinon, { SinonSandbox } from 'sinon'
import delay from 'delay'
import { SerialQueue } from '~adapter/queue'

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
	const spy = t.context.sandbox.spy((): void => {})
	const q = new SerialQueue()
	t.timeout(1000)
	await q.add(spy)
	t.is(spy.callCount, 1)
})

test('runs tasks in order', async (t): Promise<void> => {
	debugger
	const q = new SerialQueue()
	const spy = t.context.sandbox.spy
	let count = 0
	const l = [
		spy(async (): Promise<boolean> => count++ === 4),
		spy(async (): Promise<boolean> => count++ === 3),
		spy((): boolean => count++ === 2),
		spy(async (): Promise<boolean> => count++ === 1),
		spy(async (): Promise<boolean> => count++ === 0),
	]
	const p: Promise<boolean | void>[] = []
	const emitter = new Emitter()
	const flush = emitter.once('flush')
	const done = emitter.once('done')
	q.add(
		(): Promise<void> =>
			flush.then(() => {
				t.is(count, 0)
			})
	)
	for (const x of l.reverse()) {
		p.push(q.add(x))
	}
	q.add((): void => {
		emitter.emit('done')
	})
	await delay(100).then((): void => {
		emitter.emit('flush')
	})
	await done
	t.is(count, l.length)
	for (const x of l) {
		t.is(x.callCount, 1)
		t.true(await x.firstCall.returnValue)
	}
	for (const x of p) {
		t.true(await x)
	}
})

test('can cancel tasks', async (t): Promise<void> => {
	const q = new SerialQueue()
	const spy = t.context.sandbox.spy((): void => {})
	const emitter = new Emitter()
	const count = 5
	q.add((): Promise<unknown> => emitter.once('flush'))
	for (let x = 0; x < count; x++) {
		q.add(spy)
	}
	q.clear()
	const done = emitter.once('done')
	q.add((): Promise<unknown> => done)
	emitter.emit('flush')
	setImmediate((): void => {
		emitter.emit('done')
	})
	await done
	t.is(spy.callCount, 0)
})

test('forwards errors', async (t): Promise<void> => {
	const spy = t.context.sandbox.spy((): never => {
		throw new Error('Simulated error.')
	})
	const q = new SerialQueue()
	const emitter = new Emitter()
	q.add((): Promise<unknown> => emitter.once('flush'))
	const p = q.add(spy)
	emitter.emitSerial('flush')
	await t.throwsAsync(p)
})
