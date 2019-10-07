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
import TestInfo from '~worker/test_info'
import FileInfo from '~worker/file_info'
import ConfigInfo from '~worker/config_info'

interface Context {
	config: ConfigInfo
}

const test = anyTest as TestInterface<Context>

test.beforeEach((t): void => {
	const c = new ConfigInfo('ava.config.js')
	t.context.config = c
})

test.afterEach((t): void => {
	t.context.config.dispose()
})

test('create file info', (t): void => {
	const { config } = t.context
	const info = new FileInfo('t.js', config)
	t.is(info.name, 't.js')
	t.true(info.id.startsWith('f'))
	t.not(config.getFileID('t.js'), null)
	t.true(FileInfo.idExists(info.id))
})

test('file info id is unique', (t): void => {
	const { config } = t.context
	const a = new FileInfo('t.js', config)
	const b = new FileInfo('t.js', config)
	t.not(a.id, b.id)
})

test('file info test infos', (t): void => {
	const { config } = t.context
	const file = new FileInfo('t.js', config)
	const tests = [new TestInfo('a', file), new TestInfo('b', file)]
	t.is(file.getTestID('c'), null)
	t.deepEqual([...file.entries], tests)
	for (const x of tests) {
		t.is(file.getTestID(x.name), x.id)
		t.is(config.getTestID(x.name, 't.js'), x.id)
	}
})

test.serial('file info dispose releases id', (t): void => {
	const { config } = t.context
	const a = new FileInfo('t.js', config)
	a.dispose()
	t.false(FileInfo.idExists(a.id))
})
