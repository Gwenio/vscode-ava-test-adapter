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
	private prefix: string = ''
	private rootSuite: TestSuiteInfo = {
		type: 'suite',
		id: 'root',
		label: 'AVA',
		children: []
	}
	private readonly files = new Set<string>()
	private readonly suiteHash = new Map<string, TestSuiteInfo & Info>()
	private readonly testHash = new Map<string, TestInfo & Info>()

	public constructor() { }

	public clear(): void {
		this.prefix = ''
		this.rootSuite = {
			type: 'suite',
			id: 'root',
			label: 'AVA',
			children: []
		}
		this.files.clear()
		this.suiteHash.clear()
		this.testHash.clear()
	}

	public pushPrefix(meta: Prefix, log: Log): void {
		const prefix = meta.prefix
		if (log.enabled) {
			log.info(`Received test file prefix ${prefix} from worker`)
		}
		this.prefix = prefix
	}

	public pushFile(meta: TestFile, log: Log): void {
		if (log.enabled) {
			log.info(`Received test file ${meta.id} from worker`)
		}
		const id = meta.id
		const label = meta.file
		const file = this.prefix + label
		this.suiteHash.set(id, {
			type: 'suite',
			id,
			label,
			file,
			tooltip: process.env.NODE_ENV === 'production' ? label : id,
			children: []
		})
		this.files.add(file)
	}

	public pushTest(meta: TestCase, log: Log): void {
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
		this.testHash.set(id, x)
		suite.children.push(x)
	}

	public build(): void {
		const suites = this.rootSuite.children
		this.suiteHash.forEach((value): void => {
			sortTestInfo(value)
			suites.push(value)
		})
		// Sort the suites by their filenames
		this.rootSuite.children = suites.sort((a, b): (1 | -1) => {
			return a.label.toLocaleLowerCase() < b.label.toLocaleLowerCase() ? -1 : 1
		})
	}

	public get rootNode(): TestSuiteInfo {
		return this.rootSuite
	}

	public getTest(id: string): (TestInfo & Info) | null {
		return this.testHash.get(id) || null
	}

	public get prefixSize(): number {
		return this.prefix.length
	}

	public prefixFile(file: string): string {
		return this.prefix + file
	}

	public hasFile(file: string): boolean {
		return this.files.has(file)
	}

	public getFiles(): string[] {
		const files: string[] = []
		for (const f of this.files) {
			files.push(f)
		}
		return files
	}
}
