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
import Emitter from 'emittery'
import { Worker } from '../../src/adapter/worker'
import { SerialQueue } from '../../src/adapter/queue'

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

const inspectFilter = /^--inspect(.*)/i
const workerConfig = {
	cwd: process.cwd(),
	environment: process.env,
	nodePath: process.execPath,
	nodeArgv: process.execArgv.filter((x): boolean => !inspectFilter.test(x)),
}
const workerPath = '../../../dist/child.js'

test('start up and shut down', async (t): Promise<void> => {
	const spy = t.context.sandbox.spy
	const q = new SerialQueue()
	const emitter = new Emitter()
	const exited = q.add(() => emitter.once('exit'))
	const onConnect = spy((w: Worker): void => {
		w.disconnect()
	})
	const onDisconnect = spy((_: Worker): void => {})
	const onExit = spy((_: Worker): void => {
		emitter.emitSerial('exit')
	})
	const w = new Worker(workerConfig, workerPath)
		.on('error', (x): void => {
			q.add((): void => {
				t.log(x)
			})
		})
		.once('connect', onConnect)
		.once('disconnect', onDisconnect)
		.once('exit', onExit)
	t.timeout(30000)
	await exited
	await q.add((): void => {
		t.is(onConnect.callCount, 1)
		t.true(onConnect.firstCall.calledWithExactly(w))
		t.is(onDisconnect.callCount, 1)
		t.true(onDisconnect.firstCall.calledWithExactly(w))
		t.is(onExit.callCount, 1)
		t.true(onExit.firstCall.calledWithExactly(w))
		t.true(w.exitCode === 0 || w.exitCode === null)
	})
})
