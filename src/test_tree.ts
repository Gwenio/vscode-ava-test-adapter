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
import { Log } from 'vscode-test-adapter-util'
import hashSum from 'hash-sum'
import random from 'random'
import seedrandom from 'seedrandom'
import { AVATestMeta } from './ipc'

function sortTestInfo(suite: (TestInfo | TestSuiteInfo)): TestSuiteInfo {
	const s = suite as TestSuiteInfo
	if (s.children) {
		s.children = s.children.sort((a, b): number => {
			return (a.line || 0) - (b.line || 0)
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
	private generate = random.uniformInt(0, 1)
	private readonly hashes = new Set<string>()
	private readonly suiteMap = new Map<string, TestSuiteInfo>()
	private readonly testMap = new Map<string, Map<string, TestInfo>>()
	private readonly testHash = new Map<string, TestInfo>()

	private getHash(file: string, title?: string): string {
		const h = this.hashes
		let x = `${file}${title || file}`
		do {
			x = hashSum(x + this.generate().toString(16))
		} while (h.has(x))
		h.add(x)
		return x
	}

	public constructor() { }

	public clear(): void {
		this.prefix = ''
		this.rootSuite = {
			type: 'suite',
			id: 'root',
			label: 'AVA',
			children: []
		}
		this.hashes.clear()
		this.suiteMap.clear()
		this.testMap.clear()
		this.testHash.clear()
	}

	public pushMetadata(meta: AVATestMeta, log: Log): void {
		if (meta.type === 'prefix') {
			const prefix = meta.prefix
			if (log.enabled) {
				log.info(`Received test file prefix ${prefix} from worker`)
			}
			this.prefix = prefix
			random.use(seedrandom(prefix)())
			this.generate = random.uniformInt(0, Number.MAX_SAFE_INTEGER)
		} else if (meta.type === 'file') {
			if (log.enabled) {
				log.info(`Received test file ${meta.id} from worker`)
			}
			const id = meta.id
			this.suiteMap.set(id, {
				type: 'suite',
				id: id,
				label: id,
				file: this.prefix + id,
				children: []
			})
		} else if (meta.type === 'case') {
			if (log.enabled) {
				log.info(`Received test case ${meta.id} from worker`)
			}
			const id = meta.id
			const file = meta.file
			const suite = this.suiteMap.get(file)
			if (suite) {
				const hash = this.getHash(file, id)
				const x: TestInfo = {
					type: 'test',
					id: hash,
					label: id,
					file: this.prefix + file
				}
				if (process.env.NODE_ENV !== 'production') {
					x.tooltip = hash
				}
				if (log.enabled) {
					log.info(`Generated test case ID: ${hash}`)
				}
				this.testHash.set(hash, x)
				suite.children.push(x)
			} else {
				throw new Error('Could not find the file suite of a test case.')
			}
		} else {
			throw new TypeError('Unexpected message from worker.')
		}
	}

	public build(): void {
		const suites = this.rootSuite.children
		this.suiteMap.forEach((value, key): void => {
			sortTestInfo(value)
			const idMap = new Map<string, TestInfo>()
			value.children.forEach((test): void => {
				if (test.type === 'test') {
					idMap.set(test.label, test)
				} else {
					throw new TypeError('File Test Suites should only contain Tests.')
				}
			})
			this.testMap.set(key, idMap)
			suites.push(value)
		})
		// Sort the suites by their filenames
		this.rootSuite.children = suites.sort((a, b): (1 | -1) => {
			return a.id.toLocaleLowerCase() < b.id.toLocaleLowerCase() ? -1 : 1
		})
	}

	public get rootNode(): TestSuiteInfo {
		return this.rootSuite
	}

	public findTest(id: string, file: string): TestInfo | null {
		const idMap = this.testMap.get(file)
		if (idMap) {
			return idMap.get(id) || null
		} else {
			return null
		}
	}

	public getTest(id: string): TestInfo | null {
		return this.testHash.get(id) || null
	}

	public get prefixSize(): number {
		return this.prefix.length
	}

	public prefixFile(file: string): string {
		return this.prefix + file
	}

	public hasFile(file: string): boolean {
		return this.suiteMap.has(file)
	}

	public getFiles(): string[] {
		const files: string[] = []
		for (const f of this.suiteMap.keys()) {
			files.push(f)
		}
		return files
	}
}
