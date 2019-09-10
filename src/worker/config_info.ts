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

import Emitter from 'events'
import hash from './hash'
import { setup, Setup } from './ava_setup'
import { worker } from './ava_worker'
import { Tree, Event } from '../ipc'
import { LoadReporter, TestReporter, TestEmitter, DebugReporter, TestResult } from '../reporter'
import FileInfo from './file_info'
import TestInfo from './test_info'

/** Logger callback type. */
type Logger = (message: string) => void

interface Loaded {
	prefix: string
	info: {
		file: string
		tests: string[]
	}[]
}

interface DebugPlan {
	plan?: string[]
	port: number
	serial: boolean
}

/** Stores information on a test configuration. */
export default class ConfigInfo {
	/** The ID of the test configuration. */
	public readonly id: string

	/** The name of the file containing the configuration. */
	public readonly name: string

	/** The common prefix of test files in the configuration. */
	private prefix = ''

	/** The loaded AVA configuration. */
	private readonly config: Setup

	/** The IDs associated with the configuration. */
	private readonly idSet = new Set<string>()

	/** The test files included by the configuration. */
	private readonly files = new Map<string, FileInfo>()

	/** The test cases from the configuration. */
	private readonly tests = new Map<string, TestInfo>()

	/** Used to cancel a test run, if one is active. */
	private stop?: () => void

	/** Set of active configuration IDs. */
	private static readonly configSet = new Set<string>()

	/** Used to check if an ID is in use. */
	public static readonly idExists = ConfigInfo.configSet.has.bind(ConfigInfo.configSet)

	/**
	 * Constructor.
	 * @param name The configuration file name.
	 * @param logger Optional logger callback.
	 */
	public constructor(name: string, logger?: Logger) {
		this.config = setup(name, logger)
		this.name = name
		const i = hash(name, ConfigInfo.idExists, (h): string => 'c' + h)
		this.id = i
		ConfigInfo.configSet.add(i)
	}

	/**
	 * Load the configuration.
	 * @param logger Optional logger callback.
	 * @returns this
	 */
	public async load(logger?: Logger): Promise<ConfigInfo> {
		const c = this.config
		const reporter = new LoadReporter(c.match, logger)
		await worker({ ...c, match: [''] }, { reporter, logger })
		this.build(reporter.report)
		return this
	}

	/**
	 * Collects information on the configuration.
	 * @param send Callback to to send information.
	 * @param _logger Unused. Optional logger callback.
	 */
	public async collectInfo(send: (data: Tree) => void, _logger?: Logger): Promise<void> {
		const i = this.id
		send({
			type: 'prefix',
			id: i,
			file: this.name,
			prefix: this.prefix,
		})
		for (const f of this.files.values()) {
			const id = f.id
			send({
				type: 'file',
				id,
				config: i,
				file: f.name,
			})
			for (const t of f.entries) {
				send({
					type: 'case',
					id: t.id,
					file: id,
					test: t.name,
				})
			}
		}
	}

	/**
	 * Runs tests.
	 * @param send Callback to send results.
	 * @param plan The IDs to include in the run.
	 * @param logger Optional logger callback.
	 */
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
		}
		if (plan && !plan.includes(this.id)) {
			const { files, match } = this.processPlan(plan)
			if (files.length > 0) {
				const c = match ? { ...config, match } : config
				await worker(c, {
					reporter,
					logger,
					files,
					interrupt: callback,
				}).finally(done)
			}
		} else {
			await worker(config, {
				reporter,
				logger,
				files: [...this.files.values()].map((value): string => value.name),
				interrupt: callback,
			}).finally(done)
		}
	}

	/**
	 * Debugs tests.
	 * @param ready Callback to singal debug session is ready.
	 * @param plan IDs to include in the test run.
	 * @param logger Optional logger callback.
	 */
	public async debug(
		ready: (port: number) => void,
		plan: DebugPlan,
		logger?: Logger
	): Promise<void> {
		const config = {
			...this.config,
			serial: plan.serial || this.config.serial,
		}
		const reporter = new DebugReporter(ready, plan.port, logger)
		const p = plan.plan
		if (p && !p.includes(this.id)) {
			const { files, match } = this.processPlan(p)
			if (files.length > 0) {
				const c = match ? { ...config, match } : config
				for (const f of files) {
					await worker(c, {
						reporter,
						logger,
						port: await reporter.selectPort(),
						files: [f],
					})
				}
			}
		} else {
			for (const f of this.files.values()) {
				await worker(config, {
					reporter,
					logger,
					port: await reporter.selectPort(),
					files: [f.name],
				})
			}
		}
	}

	/** Cancels the active test run. */
	public cancel(): void {
		const s = this.stop
		if (s) {
			s()
		}
	}

	/** Disposes of the configuration. */
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

	/**
	 * Gets the ID of a file.
	 * @param file The name of the file.
	 * @returns The ID or null if not found.
	 */
	public getFileID(file: string): string | null {
		for (const f of this.files.values()) {
			if (f.name === file) {
				return f.id
			}
		}
		return null
	}

	/**
	 * Gets the ID of a test case.
	 * @param title The title of the test case.
	 * @param file The name of the file containing the test case.
	 * @returns The ID or null if not found.
	 */
	public getTestID(title: string, file: string): string | null {
		for (const f of this.files.values()) {
			if (f.name === file) {
				return f.getTestID(title)
			}
		}
		return null
	}

	/**
	 * Addes a test file to the config.
	 * @param f The FileInfo to add.
	 */
	public addFile(f: FileInfo): void {
		this.files.set(f.id, f)
	}

	/**
	 * Addes a test case to the config.
	 * @param t The TestInfo to add.
	 */
	public addTest(t: TestInfo): void {
		this.tests.set(t.id, t)
	}

	/**
	 * Processes loaded configuration information.
	 * @param data The loaded data.
	 * @param _logger Unused. Optional logger callback.
	 */
	private async build(data: Loaded, _logger?: Logger): Promise<void> {
		const p = data.prefix
		this.prefix = p
		this.config.resolveTestsFrom = p
		const files = this.files
		const t = this.tests
		const i = this.idSet.add.bind(this.idSet)
		for (const { file, tests } of data.info) {
			const y = new FileInfo(file, this)
			for (const title of tests) {
				const z = new TestInfo(title, y)
				t.set(z.id, z)
				i(z.id)
			}
			i(y.id)
			files.set(y.id, y)
		}
	}

	/**
	 * Processes the plan for a test run.
	 * @param plan The IDs in the run.
	 */
	private processPlan(plan: string[]): { files: string[]; match?: string[] } {
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
		if (m.size > 0) {
			return { files: [...f], match: [...m] }
		} else {
			return { files: [...f] }
		}
	}
}
