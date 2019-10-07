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
import TestInfo from '~worker/test_info'
import FileInfo from '~worker/file_info'
import ConfigInfo from '~worker/config_info'

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

test('create config info', (t): void => {
	const spy = t.context.sandbox.spy()
	const config = new ConfigInfo('ava.config.js', spy)
	t.is(config.name, 'ava.config.js')
	t.true(spy.called)
	t.true(ConfigInfo.idExists(config.id))
	config.dispose()
})

test('config info find IDs', (t): void => {
	const config = new ConfigInfo('ava.config.js')
	const file = new FileInfo('t.js', config)
	const info = new TestInfo('a', file)
	t.is(config.getFileID(file.name), file.id)
	t.is(config.getFileID('x.js'), null)
	t.is(config.getTestID(info.name, file.name), info.id)
	t.is(config.getTestID(info.name, 'x.js'), null)
	t.is(config.getTestID('b', file.name), null)
	config.dispose()
})

test.serial('dispose config info', (t): void => {
	const config = new ConfigInfo('ava.config.js')
	const file = new FileInfo('t.js', config)
	const info = new TestInfo('a', file)
	t.true(ConfigInfo.idExists(config.id))
	t.true(FileInfo.idExists(file.id))
	t.true(TestInfo.idExists(info.id))
	config.dispose()
	t.false(ConfigInfo.idExists(config.id))
	t.false(FileInfo.idExists(file.id))
	t.false(TestInfo.idExists(info.id))
})
