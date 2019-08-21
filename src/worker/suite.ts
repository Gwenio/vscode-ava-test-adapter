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
import AVA from 'ava/namespace'
import { setup, Setup } from './ava_setup'
import { worker } from './ava_worker'
import {
	LoadReporter,
	TestReporter,
	TestEmitter,
	DebugReporter
} from '../reporter'
import {
	Tree
} from '../ipc'
import TestInfo from './test_info'
import FileInfo from './file_info'

type Logger = (message: string) => void

interface Loaded {
	prefix: string;
	info: {
		file: string;
		tests: string[];
	}[];
}

export default class Suite {
	private readonly config: Setup
	private readonly file: string
	private prefix = ''
	private readonly files = new Map<string, FileInfo>()
	private readonly tests = new Map<string, TestInfo>()
	private working: Promise<void> = Promise.resolve()
	private stop?: () => void

	public constructor(file: string, logger?: Logger) {
		this.file = file
		this.config = setup(file, logger)
	}

	public getFileID(name: string): string | null {
		for (const f of this.files.values()) {
			if (f.name === name) {
				return f.id
			}
		}
		return null
	}

	public getTestID(name: string, file: string): string | null {
		for (const f of this.files.values()) {
			if (f.name === file) {
				return f.getTestID(name)
			}
		}
		return null
	}

	public cancel(): void {
		const s = this.stop
		if (s) {
			s()
		}
	}

	public async load(logger?: Logger): Promise<AVA.Status> {
		const reporter = new LoadReporter((report): void => {
			this.working = this.build(report, logger)
		}, this.config.match, logger)
		const c = {
			...this.config,
			match: ['']
		}
		return worker(c, {
			reporter,
			logger
		}).finally(reporter.endRun.bind(reporter))
	}

	public async run(emit: TestEmitter, plan: string[], logger?: Logger): Promise<AVA.Status> {
		const config = this.config
		const reporter = new TestReporter(emit, this.prefix.length, logger)
		const callback = (interrupt: () => void): void => {
			this.stop = interrupt
		}
		const done = (): void => {
			this.stop = undefined
			reporter.endRun()
		}
		const { files, match } = this.processPlan(plan, config.resolveTestsFrom)
		if (files) {
			if (match) {
				const c = {
					...this.config,
					match
				}
				return worker(c, {
					reporter,
					logger,
					files,
					interrupt: callback
				}).finally(done)
			} else {
				return worker(config, {
					reporter,
					logger,
					files,
					interrupt: callback
				}).finally(done)
			}
		} else {
			return worker(config, {
				reporter,
				logger,
				interrupt: callback
			}).finally(done)
		}
	}

	public async debug(ready: () => void, plan: string[], port: number, serial: boolean,
		logger?: Logger): Promise<void> {
		const config = {
			...this.config,
			serial: serial || this.config.serial
		}
		const prefix = this.prefix
		const from = config.resolveTestsFrom
		const tests = this.tests
		const reporter = new DebugReporter(ready, logger)
		const done = reporter.endRun.bind(reporter)
		for (const p of plan) {
			if (p.startsWith('t')) {
				const t = tests.get(p)
				if (t) {
					config.match = [t.name]
					await worker(config, {
						reporter,
						logger,
						port,
						files: [path.relative(from, prefix + t.fileName)]
					}).finally(done)
				} else {
					console.error(`Could not find test case with ID: ${p}`)
				}
			} else {
				console.error('Only debugging of individual tests is supported.')
			}
		}
	}

	public async collectInfo(send: (data: Tree) => void): Promise<void> {
		await this.working
		send({
			type: 'prefix',
			id: '',
			file: this.file,
			prefix: this.prefix
		})
		for (const f of this.files.values()) {
			const id = f.id
			send({
				type: 'file',
				id,
				config: '',
				file: f.name
			})
			for (const t of f.entries) {
				send({
					type: 'case',
					id: t.id,
					file: id,
					test: t.name
				})
			}
		}
	}

	private async build(data: Loaded, _logger?: Logger): Promise<void> {
		this.prefix = data.prefix
		const files = this.files
		const t = this.tests
		const fileIdExists = files.has.bind(files)
		const testIdExists = t.has.bind(t)
		for (const { file, tests } of data.info) {
			const y = new FileInfo(file, fileIdExists)
			for (const title of tests) {
				const z = new TestInfo(title, y, testIdExists)
				t.set(z.id, z)
				y.addTest(z)
			}
			files.set(y.id, y)
		}
	}

	private processPlan(plan: string[], from: string): { files?: string[]; match?: string[] } {
		const prefix = this.prefix
		const files = this.files
		const tests = this.tests
		const f = new Set<string>()
		const m = new Set<string>()
		for (const p of plan) {
			if (p === 'root') {
				return {}
			} else if (p.startsWith('f')) {
				const lookup = files.get(p)
				if (lookup) {
					for (const t of lookup.entries) {
						m.add(t.name)
					}
					f.add(lookup.name)
				}
			} else if (p.startsWith('t')) {
				const t = tests.get(p)
				if (t) {
					m.add(t.name)
					f.add(t.fileName)
				}
			}
		}
		if (f.size > 0) {
			const select: string[] = []
			for (const x of f) {
				select.push(path.relative(from, prefix + x))
			}
			if (m.size > 0) {
				const match: string[] = []
				for (const x of m) {
					match.push(x)
				}
				return { files: select, match }
			} else {
				return { files: select }
			}
		} else {
			return {}
		}
	}
}
