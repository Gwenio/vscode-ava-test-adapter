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

import AVA from 'ava/namespace' // eslint-disable-line node/no-missing-import
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

	/** The common prefix length. */
	private length = 0

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

	/**
	 * @inheritdoc
	 * @override
	 */
	protected reset(): void {
		super.reset()
		this.running = true
		this.files.clear()
		this.tests = []
	}

	/**
	 * @inheritdoc
	 * @override
	 */
	public startRun(plan: AVA.Plan): void {
		super.startRun(plan)
		this.log('Begin Loading.')
		const p = plan.filePathPrefix
		this.data.prefix = p
		this.length = p.length
	}

	/**
	 * Pushes information on a test.
	 * @param title The test's title.
	 * @param file The file containing the test.
	 */
	private push(title: string, file: string): void {
		this.files.add(file)
		this.tests.push({ title, file })
	}

	/**
	 * @inheritdoc
	 * @override
	 */
	protected consumeStateChange(event: AVA.Event): void {
		switch (event.type) {
			case 'declared-test':
				this.push(event.title, event.testFile.slice(this.length))
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

	/**
	 * @inheritdoc
	 * @override
	 */
	public endRun(): void {
		if (this.running) {
			this.running = false
			const tests = this.tests
			const i: Info[] = []
			for (const file of this.files) {
				const x = tests
					.filter(({ file: y }): boolean => y === file)
					.map(({ title: z }): string => z)
				if (x.length > 0) {
					i.push({
						file,
						tests: x,
					})
				}
			}
			const filter = this.filter
			if (i.length > 0 && filter.length > 0) {
				const x: Info[] = []
				for (const y of i) {
					const z = matcher(y.tests, filter)
					if (z.length > 0) {
						x.push({ file: y.file, tests: z })
					}
				}
				this.data.info = x
			} else {
				this.data.info = i
			}
			this.log('Loading Complete.')
		}
	}

	/** The report produced by the previous run. */
	public get report(): Loaded {
		return this.data
	}
}
