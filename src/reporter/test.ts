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

type Logger = (message: string) => void

export interface TestResult {
	state: 'skipped' | 'passed' | 'failed'
	file: string
	test: string
}

export interface TestEmitter {
	emit(event: 'end'): void
	emit(event: 'done', message: string): void
	emit(event: 'result', message: TestResult): void
}

export class TestReporter extends AbstractReporter {
	private readonly reporter: TestEmitter
	private readonly log: Logger = (_message: string): void => {}
	private readonly prefix: number
	private running = false

	public constructor(reporter: TestEmitter, prefix: number, log?: Logger) {
		super()
		this.reporter = reporter
		this.prefix = prefix
		if (log) {
			this.log = log
		}
	}

	public reset(): void {
		super.reset()
		this.running = true
	}

	public startRun(plan: AVA.Plan): void {
		super.startRun(plan)
		this.log('Begin Run.')
	}

	public consumeStateChange(event: AVA.Event): void {
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

	public endRun(): void {
		if (this.running) {
			this.running = false
			this.log('Run Complete.')
			this.reporter.emit('end')
		}
	}
}
