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

import AVA from 'ava/namespace'
import commonFilePrefix from 'common-path-prefix'
import matcher from 'matcher'
import AbstractReporter from './reporter'

/** Logger callback type. */
type Logger = (message: string) => void

/** The information for a test file. */
interface Info {
	/** The test file name. */
	file: string

	/** The titles of tests in the file. */
	tests: string[]
}

/** The loaded data for LoadReporter. */
interface Loaded {
	/** The common prefix of test files. */
	prefix: string

	/** Test file info. */
	info: Info[]
}

/** A record of test information. */
interface TestCase {
	file: string
	title: string
}

/** Reporter for loading test information. */
export default class LoadReporter extends AbstractReporter {
	/** Logging callback. */
	private readonly log: Logger = (_message: string): void => {}

	/** Tracks if there is an active run. */
	private running = false

	/** Array of matcher expressions for test titles to accept. */
	private readonly filter: string[]

	/** The set of test files. */
	private files: Set<string> = new Set<string>()

	/** Stores the declared tests. */
	private tests: TestCase[] = []

	/** The data for this.report. */
	private data: Loaded = {
		prefix: '',
		info: [],
	}

	/**
	 * Constructor.
	 * @param filter Array of matcher expressions for test titles to accept.
	 * @param log Logger function.
	 */
	public constructor(filter: string[], log?: Logger) {
		super()
		this.filter = filter
		if (log) {
			this.log = log
		}
	}

	/** @inheritdoc */
	protected reset(): void {
		super.reset()
		this.running = true
		this.files.clear()
		this.tests = []
	}

	/** @inheritdoc */
	public startRun(plan: AVA.Plan): void {
		super.startRun(plan)
		this.log('Begin Run.')
	}

	/** @inheritdoc */
	protected consumeStateChange(event: AVA.Event): void {
		switch (event.type) {
			case 'declared-test':
				this.files.add(event.testFile)
				this.tests.push({
					title: event.title,
					file: event.testFile,
				})
				return
			case 'worker-stderr':
				process.stderr.write(event.chunk)
				return
			case 'worker-stdout':
				process.stdout.write(event.chunk)
				return
			default:
				return
		}
	}

	/** @inheritdoc */
	public endRun(): void {
		if (this.running) {
			this.running = false
			let files: string[] = []
			this.files.forEach((value): void => {
				files.push(value)
			})
			const prefix: string = commonFilePrefix(files)
			const length = prefix.length
			files = files.map((value): string => value.slice(length))
			const tests = this.tests
			this.data = {
				prefix,
				info: files.map(
					(file): Info => {
						const list = tests
							.filter((value): boolean => {
								return value.file.slice(length) === file
							})
							.map((value): string => {
								return value.title
							})
						return {
							file,
							tests: matcher(list, this.filter),
						}
					}
				),
			}
			this.log('Run Complete.')
		}
	}

	/** The report produced by the previous run. */
	public get report(): Loaded {
		return this.data
	}
}
