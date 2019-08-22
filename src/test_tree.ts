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
import {
	TestInfo,
	TestSuiteInfo,
} from 'vscode-test-adapter-api'
import { Log } from 'vscode-test-adapter-util/out/log'
import { Prefix, TestFile, TestCase } from './ipc'

interface Info {
	id: string;
	label: string;
	file: string;
}

function sortTestInfo(suite: (TestInfo | TestSuiteInfo)): TestSuiteInfo {
	const s = suite as TestSuiteInfo
	if (s.children) {
		s.children = s.children.sort((a, b): number => {
			return a.label.toLocaleLowerCase() < b.label.toLocaleLowerCase() ? -1 : 1
		})
		s.children.forEach(sortTestInfo)
	}
	return s
}

export default class TestTree {
	private prefix = ''
	private rootSuite: TestSuiteInfo = {
		type: 'suite',
		id: 'root',
		label: 'AVA',
		children: []
	}
	private readonly base: string
	private readonly files = new Set<string>()
	private readonly suiteHash = new Map<string, TestSuiteInfo & Info>()
	private readonly log: Log

	public constructor(log: Log, base: string) {
		this.log = log
		this.base = base
	}

	public pushPrefix(meta: Prefix): void {
		const log = this.log
		const prefix = meta.prefix
		if (log.enabled) {
			log.info(`Received test file prefix ${prefix} from worker`)
		}
		this.prefix = prefix
		this.files.add(path.resolve(this.base, meta.file))
	}

	public pushFile(meta: TestFile): void {
		const log = this.log
		if (log.enabled) {
			log.info(`Received test file ${meta.id} from worker`)
		}
		const id = meta.id
		const label = meta.file
		const file = this.prefix + label
		const x: TestSuiteInfo & Info = {
			type: 'suite',
			id,
			label,
			file,
			tooltip: process.env.NODE_ENV === 'production' ? label : id,
			children: []
		}
		this.suiteHash.set(id, x)
		this.rootSuite.children.push(x)
		this.files.add(file)
	}

	public pushTest(meta: TestCase): void {
		const log = this.log
		const id = meta.id
		if (log.enabled) {
			log.info(`Received test case ${id} of file ${meta.file} from worker`)
		}
		const label = meta.test
		const suite = this.suiteHash.get(meta.file)
		if (!suite) {
			log.error(`Test Case for unknown Test File: ${meta.file}`)
			return
		}
		const x: TestInfo & Info = {
			type: 'test',
			id,
			label,
			tooltip: process.env.NODE_ENV === 'production' ? label : id,
			file: suite.file
		}
		suite.children.push(x)
	}

	public build(): void {
		this.suiteHash.clear()
		sortTestInfo(this.rootSuite)
	}

	public get rootNode(): TestSuiteInfo {
		return this.rootSuite
	}

	public getFiles(): Set<string> {
		return this.files
	}
}
