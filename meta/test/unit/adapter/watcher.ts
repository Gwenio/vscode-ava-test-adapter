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

import path from 'path'
import anyTest, { TestInterface } from 'ava'
import sinon, { SinonSandbox } from 'sinon'
import delay from 'delay'
import Log from '~adapter/log'
import Watcher from '~adapter/watcher'

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

const workPath = process.cwd()

const logger = (..._: []): void => {}

const fakeLog: Log = {
	enabled: false,
	info: logger,
	warn: logger,
	error: logger,
	debug: logger,
}

test('create and dispose', async (t): Promise<void> => {
	t.notThrows((): void => {
		const w = new Watcher(fakeLog)
		w.dispose()
	})
})

test('emits run when active', async (t): Promise<void> => {
	const run = t.context.sandbox.spy()
	const base = path.join(workPath, 'dir')
	const w = new Watcher(fakeLog).on('run', run)
	w.changed(path.join(base, 'x.js'), true)
	w.changed(path.join(workPath, 'y.js'), false)
	w.activate = true
	w.changed(path.join(workPath, 'y.js'), false)
	await delay(100)
	t.false(run.called)
	w.changed(path.join(base, 'x.js'), true)
	await delay(100)
	t.true(run.called)
	w.dispose()
	w.changed(path.join(base, 'x.js'), true)
	await delay(100)
	t.is(run.callCount, 1)
})

test('emits load when active', async (t): Promise<void> => {
	const load = t.context.sandbox.spy()
	const base = path.join(workPath, 'dir')
	const w = new Watcher(fakeLog).on('load', load)
	w.watch = new Set<string>([path.join(base, 'x.js')])
	w.changed(path.join(base, 'x.js'), true)
	w.changed(path.join(base, 'z.js'), true)
	w.changed(path.join(workPath, 'y.js'), false)
	w.activate = true
	w.changed(path.join(workPath, 'y.js'), false)
	w.changed(path.join(base, 'z.js'), true)
	await delay(100)
	t.false(load.called)
	w.changed(path.join(base, 'x.js'), true)
	await delay(100)
	t.true(load.called)
	w.dispose()
	w.changed(path.join(base, 'x.js'), true)
	await delay(100)
	t.is(load.callCount, 1)
})

test('emits run when tracked file changes', async (t): Promise<void> => {
	const spy = t.context.sandbox.spy
	const run = spy()
	const load = spy()
	const base = path.join(workPath, 'dir')
	const a = path.join(base, 'a.js')
	const x = path.join(base, 'x.js')
	const y = path.join(workPath, 'y.js')
	const z = path.join(workPath, 'z.js')
	const w = new Watcher(fakeLog).on('run', run).on('load', load)
	w.activate = true
	w.watch = new Set<string>([x, y])
	w.changed(a, true)
	w.changed(x, true)
	w.changed(y, false)
	w.changed(z, false)
	await delay(100)
	t.is(run.callCount, 3)
	t.is(load.callCount, 2)
})
