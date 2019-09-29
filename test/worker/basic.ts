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
import delay from 'delay'
// eslint-disable-next-line node/no-unpublished-import
import through from 'through2'
// eslint-disable-next-line node/no-unpublished-import
import is from '@sindresorhus/is'
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

const timeout = 10000
const inspectFilter = /^--inspect(.*)/i
const workerConfig = {
	cwd: process.cwd(),
	environment: process.env,
	nodePath: process.execPath,
	nodeArgv: process.execArgv.filter((x): boolean => !inspectFilter.test(x)),
	timeout,
}
const workerPath = '../../../dist/child.js'

test('start up and shut down', async (t): Promise<void> => {
	const spy = t.context.sandbox.spy
	const q = new SerialQueue()
	const l: (string | Buffer)[] = []
	const stream = through({ objectMode: true }, (chunk: string | Buffer, _, callback): void => {
		if (is.buffer(chunk)) {
			t.log(chunk.toString())
		} else {
			t.log(chunk)
		}
		callback()
	})
	const emitter = new Emitter()
	const exited = emitter.once('exit')
	const onConnect = spy((w: Worker): void => {
		w.disconnect()
	})
	const onDisconnect = spy((_: Worker): void => {})
	const onExit = spy((_: Worker): void => {
		emitter.emitSerial('exit')
	})
	const w = new Worker(workerConfig, stream, workerPath)
		.on('error', (x): void => {
			q.add((): void => {
				t.log(x)
			})
		})
		.once('connect', onConnect)
		.once('disconnect', onDisconnect)
		.once('exit', onExit)
	await Promise.race([exited, delay(timeout)])
	await q.add((): void => {
		for (const x of l) {
			if (is.buffer(x)) {
				t.log(x.toString())
			} else if (is.string(x)) {
				t.log(x)
			}
		}
		t.is(onConnect.callCount, 1)
		t.true(onConnect.firstCall.calledWithExactly(w))
		t.is(onDisconnect.callCount, 1)
		t.true(onDisconnect.firstCall.calledWithExactly(w))
		t.is(onExit.callCount, 1)
		t.true(onExit.firstCall.calledWithExactly(w))
		t.true(w.exitCode === 0 || w.exitCode === null)
	})
})
