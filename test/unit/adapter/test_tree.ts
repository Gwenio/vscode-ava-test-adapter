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
import Log from '../../../src/adapter/log'
import TestTree from '../../../src/adapter/test_tree'

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

const logger = (..._: []): void => {}

const fakeLog: Log = {
	enabled: false,
	info: logger,
	warn: logger,
	error: logger,
	debug: logger,
}

function makePrefix(tree: TestTree, id: number, prefix: string, file: string): void {
	tree.pushPrefix({
		type: 'prefix',
		prefix: path.join(process.cwd(), prefix) + path.sep,
		id: `c${id.toString(16)}`,
		file,
	})
}

function makeFile(tree: TestTree, id: number, config: number, file: string): void {
	tree.pushFile({
		type: 'file',
		id: `f${id.toString(16)}`,
		file,
		config: `c${config.toString(16)}`,
	})
}

function makeCase(tree: TestTree, id: number, file: number, title: string): void {
	tree.pushTest({
		type: 'case',
		id: `t${id.toString(16)}`,
		test: title,
		file: `f${file.toString(16)}`,
	})
}

test('empty tree', async (t): Promise<void> => {
	const tree = new TestTree(fakeLog, process.cwd(), (_): void => {})
	t.deepEqual(tree.build(), {
		type: 'suite',
		id: 'root',
		label: 'AVA',
		children: [],
	})
	t.is(tree.getFiles.size, 0)
	t.is(tree.getConfigs.return, undefined)
})

test('simple tree', async (t): Promise<void> => {
	const tree = new TestTree(fakeLog, process.cwd(), (_): void => {})
	makePrefix(tree, 0, 'test', 'ava.config.js')
	makeFile(tree, 0, 0, 't0.js')
	makeCase(tree, 0, 0, 'a')
	makeCase(tree, 1, 0, 'c')
	makeCase(tree, 2, 0, 'b')
	makeFile(tree, 1, 0, 't2.js')
	makeFile(tree, 2, 0, 't1.js')
	makePrefix(tree, 1, path.join('test', 'unit'), 'ava.unit.js')
	makePrefix(tree, 2, path.join('test', 'all'), 'ava.integration.js')
	t.deepEqual(tree.build(), {
		type: 'suite',
		id: 'root',
		label: 'AVA',
		children: [
			{
				type: 'suite',
				id: 'c0',
				label: 'ava.config.js',
				file: path.join(process.cwd(), 'ava.config.js'),
				children: [
					{
						type: 'suite',
						id: 'f0',
						label: 't0.js',
						file: path.join(process.cwd(), 'test', 't0.js'),
						children: [
							{
								type: 'test',
								id: 't0',
								label: 'a',
								file: path.join(process.cwd(), 'test', 't0.js'),
							},
							{
								type: 'test',
								id: 't2',
								label: 'b',
								file: path.join(process.cwd(), 'test', 't0.js'),
							},
							{
								type: 'test',
								id: 't1',
								label: 'c',
								file: path.join(process.cwd(), 'test', 't0.js'),
							},
						],
					},
					{
						type: 'suite',
						id: 'f2',
						label: 't1.js',
						file: path.join(process.cwd(), 'test', 't1.js'),
						children: [],
					},
					{
						type: 'suite',
						id: 'f1',
						label: 't2.js',
						file: path.join(process.cwd(), 'test', 't2.js'),
						children: [],
					},
				],
			},
			{
				type: 'suite',
				id: 'c2',
				label: 'ava.integration.js',
				file: path.join(process.cwd(), 'ava.integration.js'),
				children: [],
			},
			{
				type: 'suite',
				id: 'c1',
				label: 'ava.unit.js',
				file: path.join(process.cwd(), 'ava.unit.js'),
				children: [],
			},
		],
	})
	t.is(tree.getFiles.size, 6)
})

test('broken tree', async (t): Promise<void> => {
	const spy = t.context.sandbox.spy
	const spyLog: Log = {
		enabled: true,
		info: spy(logger),
		warn: spy(logger),
		error: spy(logger),
		debug: spy(logger),
	}
	const tree = new TestTree(spyLog, process.cwd(), (_): void => {})
	makePrefix(tree, 0, 'test', 'ava.config.js')
	makeFile(tree, 0, 0, 't0.js')
	makeCase(tree, 0, 0, 'a')
	makeFile(tree, 1, 1, 't1.js')
	makeCase(tree, 1, 2, 'b')
	t.deepEqual(tree.build(), {
		type: 'suite',
		id: 'root',
		label: 'AVA',
		children: [
			{
				type: 'suite',
				id: 'c0',
				label: 'ava.config.js',
				file: path.join(process.cwd(), 'ava.config.js'),
				children: [
					{
						type: 'suite',
						id: 'f0',
						label: 't0.js',
						file: path.join(process.cwd(), 'test', 't0.js'),
						children: [
							{
								type: 'test',
								id: 't0',
								label: 'a',
								file: path.join(process.cwd(), 'test', 't0.js'),
							},
						],
					},
				],
			},
		],
	})
	t.is(tree.getFiles.size, 2)
})
