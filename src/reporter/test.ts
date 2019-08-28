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
import AbstractReporter from './reporter'

/** Logger callback type. */
type Logger = (message: string) => void

/** Contains the result of a test. */
export interface TestResult {
	/** The test state. */
	state: 'skipped' | 'passed' | 'failed'

	/** The test file containing the test. */
	file: string

	/** The title of the test. */
	test: string
}

/** Emitter interface for forwarding test results. */
export interface TestEmitter {
	/**
	 * Emit an end event.
	 * @param event The type of event.
	 */
	emit(event: 'end'): void

	/**
	 * Emit a done event.
	 * @param event The type of event.
	 * @param message The file that was completed.
	 */
	emit(event: 'done', message: string): void

	/**
	 * Emit a result event.
	 * @param event The type of event.
	 * @param message The result of the test.
	 */
	emit(event: 'result', message: TestResult): void
}

/** Reporter for running tests. */
export class TestReporter extends AbstractReporter {
	/** Emitter to forward test results to. */
	private readonly reporter: TestEmitter

	/** Logging callback. */
	private readonly log: Logger = (_message: string): void => {}

	/** The length of the common prefix of file names. */
	private readonly prefix: number

	/** Tracks if there is an active run. */
	private running = false

	/**
	 * Constructor.
	 * @param reporter Emitter to forward test results to.
	 * @param prefix The length of the common prefix of file names.
	 * @param log The logging callback.
	 */
	public constructor(reporter: TestEmitter, prefix: number, log?: Logger) {
		super()
		this.reporter = reporter
		this.prefix = prefix
		if (log) {
			this.log = log
		}
	}

	/** @inheritdoc */
	protected reset(): void {
		super.reset()
		this.running = true
	}

	/** @inheritdoc */
	public startRun(plan: AVA.Plan): void {
		super.startRun(plan)
		this.log('Begin Run.')
	}

	/** @inheritdoc */
	protected consumeStateChange(event: AVA.Event): void {
		switch (event.type) {
			case 'selected-test':
				if (event.skip) {
					this.reporter.emit('result', {
						state: 'skipped',
						file: event.testFile.slice(this.prefix),
						test: event.title,
					})
				}
				return
			case 'test-passed':
				this.reporter.emit('result', {
					state: 'passed',
					file: event.testFile.slice(this.prefix),
					test: event.title,
				})
				return
			case 'test-failed':
				this.reporter.emit('result', {
					state: 'failed',
					file: event.testFile.slice(this.prefix),
					test: event.title,
				})
				return
			case 'worker-failed':
			case 'worker-finished':
				this.reporter.emit('done', event.testFile.slice(this.prefix))
				return
			case 'worker-stderr':
				process.stderr.write(event.chunk)
				return
			case 'worker-stdout':
				process.stdout.write(event.chunk)
				return
			case 'interrupt':
				this.log('Testing interrupted.')
				return
			default:
				return
		}
	}

	/** @inheritdoc */
	public endRun(): void {
		if (this.running) {
			this.running = false
			this.log('Run Complete.')
			this.reporter.emit('end')
		}
	}
}
