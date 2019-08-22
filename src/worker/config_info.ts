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
import Emitter from 'events'
import hash from '../hash'
import { setup, Setup } from './ava_setup'
import { worker } from './ava_worker'
import { Tree, Event } from '../ipc'
import {
	LoadReporter,
	TestReporter,
	TestEmitter,
	DebugReporter,
	TestResult
} from '../reporter'
import FileInfo from './file_info'
import TestInfo from './test_info'

type Logger = (message: string) => void

interface Loaded {
	prefix: string;
	info: {
		file: string;
		tests: string[];
	}[];
}

interface DebugPlan {
	plan?: string[];
	port: number;
	serial: boolean;
}

/**
 * @summary Stores information on a test configuration.
 */
export default class ConfigInfo {
	/**
	 * @summary The ID of the test configuration.
	 */
	public readonly id: string

	/**
	 * @summary The name of the file containing the configuration.
	 */
	public readonly name: string

	/**
	 * @summary The common prefix of test files in the configuration.
	 */
	private prefix = ''

	/**
	 * @summary The loaded AVA configuration.
	 */
	private readonly config: Setup

	/**
	 * @summary The IDs associated with the configuration.
	 */
	private readonly idSet = new Set<string>()

	/**
	 * @summary The test files included by the configuration.
	 */
	private readonly files = new Map<string, FileInfo>()

	/**
	 * @summary The test cases from the configuration.
	 */
	private readonly tests = new Map<string, TestInfo>()

	/**
	 * @summary Used to cancel a test run, if one is active.
	 */
	private stop?: () => void

	/**
	 * @summary Set of active configuration IDs.
	 */
	private static readonly configSet = new Set<string>()

	/**
	 * @summary Used to check if an ID is in use.
	 */
	private static readonly idExists = ConfigInfo.configSet.has.bind(ConfigInfo.configSet)

	public constructor(name: string, logger?: Logger) {
		this.config = setup(name, logger)
		this.name = name
		const i = hash(name, ConfigInfo.idExists, 'c')
		this.id = i
		ConfigInfo.configSet.add(i)
	}

	public async load(logger?: Logger): Promise<ConfigInfo> {
		const c = this.config
		const reporter = new LoadReporter(c.match, logger)
		await worker({ ...c, match: [''] }, { reporter, logger })
		reporter.endRun()
		this.build(reporter.report)
		return this
	}


	public async collectInfo(send: (data: Tree) => void, _logger?: Logger): Promise<void> {
		const i = this.id
		send({
			type: 'prefix',
			id: i,
			file: this.name,
			prefix: this.prefix
		})
		for (const f of this.files.values()) {
			const id = f.id
			send({
				type: 'file',
				id,
				config: i,
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

	public async run(send: (data: Event) => void, plan?: string[], logger?: Logger): Promise<void> {
		const config = this.config
		const emitter: Emitter & TestEmitter = new Emitter()
			.on('done', (f: string): void => {
				const file = this.getFileID(f)
				if (file) {
					send({ type: 'done', file })
				}
			})
			.on('result', (result: TestResult): void => {
				const test = this.getTestID(result.test, result.file)
				if (test) {
					send({ type: 'result', state: result.state, test })
				}
			})
			.once('end', (): void => {
				send({ type: 'done', file: this.id })
			})
		const reporter = new TestReporter(emitter, this.prefix.length, logger)
		const callback = (interrupt: () => void): void => {
			this.stop = interrupt
		}
		const done = (): void => {
			this.stop = undefined
			reporter.endRun()
		}
		if (plan && !plan.includes(this.id)) {
			const { files, match } = this.processPlan(plan, config.resolveTestsFrom)
			if (files.length === 0) {
				return
			}
			if (match) {
				const c = {
					...this.config,
					match
				}
				await worker(c, {
					reporter,
					logger,
					files,
					interrupt: callback
				}).finally(done)
			} else {
				await worker(config, {
					reporter,
					logger,
					files,
					interrupt: callback
				}).finally(done)
			}
		} else {
			await worker(config, {
				reporter,
				logger,
				interrupt: callback
			}).finally(done)
		}
	}

	public async debug(ready: () => void, plan: DebugPlan, logger?: Logger): Promise<void> {
		const config = {
			...this.config,
			serial: plan.serial || this.config.serial
		}
		const prefix = this.prefix
		const from = config.resolveTestsFrom
		const reporter = new DebugReporter(ready, logger)
		const done = reporter.endRun.bind(reporter)
		const port = plan.port
		const p = plan.plan
		if (p && !p.includes(this.id)) {
			const { files, match } = this.processPlan(p, config.resolveTestsFrom)
			if (files.length === 0) {
				return
			}
			if (match) {
				const c = {
					...this.config,
					match
				}
				for (const f of files) {
					await worker(c, {
						reporter,
						logger,
						port,
						files: [f]
					})
				}
			} else {
				for (const f of files) {
					await worker(config, {
						reporter,
						logger,
						port,
						files: [f]
					})
				}
			}
		} else {
			for (const f of this.files.values()) {
				await worker(config, {
					reporter,
					logger,
					port,
					files: [path.relative(from, prefix + f.name)]
				}).finally(done)
			}
		}
	}

	public cancel(): void {
		const s = this.stop
		if (s) {
			s()
		}
	}

	public dispose(): void {
		this.cancel()
		ConfigInfo.configSet.delete(this.id)
		for (const f of this.files.values()) {
			f.dispose()
		}
		for (const t of this.tests.values()) {
			t.dispose()
		}
	}

	public getFileID(file: string): string | null {
		for (const f of this.files.values()) {
			if (f.name === file) {
				return f.id
			}
		}
		return null
	}

	public getTestID(title: string, file: string): string | null {
		for (const f of this.files.values()) {
			if (f.name === file) {
				return f.getTestID(title)
			}
		}
		return null
	}

	private async build(data: Loaded, _logger?: Logger): Promise<void> {
		this.prefix = data.prefix
		const files = this.files
		const t = this.tests
		const i = this.idSet.add.bind(this.idSet)
		for (const { file, tests } of data.info) {
			const y = new FileInfo(file, this)
			for (const title of tests) {
				const z = new TestInfo(title, y)
				t.set(z.id, z)
				y.addTest(z)
				i(z.id)
			}
			i(y.id)
			files.set(y.id, y)
		}
	}

	private processPlan(plan: string[], from: string): { files: string[]; match?: string[] } {
		const prefix = this.prefix
		const files = this.files
		const tests = this.tests
		const f = new Set<string>()
		const m = new Set<string>()
		for (const p of plan.filter((value): boolean => this.idSet.has(value))) {
			if (p.startsWith('f')) {
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
		const select = [...f].map((x): string => path.relative(from, prefix + x))
		if (m.size > 0) {
			return { files: select, match: [...m] }
		} else {
			return { files: select }
		}
	}
}
