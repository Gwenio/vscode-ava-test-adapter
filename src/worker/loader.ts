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
import { setup } from './ava_setup'
import { worker } from './ava_worker'
import AbstractReporter from './reporter'
import { AVATestPrefix, AVATestFile, AVATestCase } from '../ipc'

type Sender = (message: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
type Logger = (message: string) => void

const logEnabled = JSON.parse(process.argv[3]) as boolean

interface TestCase {
	title: string;
	file: string;
}

class Reporter extends AbstractReporter {
	private readonly send: (message: AVATestPrefix | AVATestFile | AVATestCase) => void
	private readonly log: Logger = (_message: string): void => { }
	private running: boolean = false
	private filter: Set<string> = new Set<string>()
	private files: Set<string> = new Set<string>()
	private tests: TestCase[] = []

	private includes(title: string): boolean {
		const f = this.filter
		return f.size === 0 || f.has(title)
	}

	public constructor(send: Sender, log?: Logger) {
		super()
		this.send = send
		if (log) {
			this.log = log
		}
	}

	public reset(): void {
		super.reset()
		this.running = true
		this.filter.clear()
		this.files.clear()
		this.tests = []
	}

	public startRun(plan: AVA.Plan): void {
		super.startRun(plan)
		this.log('Begin Run.')
	}

	public consumeStateChange(event: AVA.Event): void {
		switch (event.type) {
			case 'declared-test':
				if (this.includes(event.title)) {
					this.files.add(event.testFile)
					this.tests.push({
						title: event.title,
						file: event.testFile
					})
				}
				break
			default:
				break
		}
	}

	public endRun(): void {
		if (this.running) {
			this.running = false
			let files: string[] = []
			this.files.forEach((value): void => {
				files.push(value)
			})
			const prefix: string = commonFilePrefix(files)
			const length = prefix.length
			this.send({
				type: 'prefix',
				prefix
			})
			files.map((value): AVATestFile => {
				return {
					type: 'file',
					id: value.slice(length)
				}
			}).forEach((value): void => {
				this.send(value)
			})
			this.tests.map((value): AVATestCase => {
				return {
					type: 'case',
					id: value.title,
					file: value.file.slice(length)
				}
			}).forEach((value): void => {
				this.send(value)
			})
			this.log('Run Complete.')
		}
	}

	public setFilter(match: string[]): void {
		const f = this.filter
		match.forEach((value): void => {
			f.add(value)
		})
	}
}

function handler(error: Error): void {
	console.error(error.stack)
	if (!process.exitCode || process.exitCode === 0) {
		process.exitCode = 1
	}
}

const avaSetup = setup(process.argv[2], logEnabled ? (message: string): void => {
	if (process.send) {
		process.send(message)
	}
} : null)
const match = avaSetup.match
avaSetup.match = ['']

const send: Sender = (message): void => {
	if (process.send) {
		process.send(message)
	} else if (process.env.NODE_ENV === 'production') {
		console.log(message)
	} else {
		throw new TypeError('process.send unavailable')
	}
}

if (logEnabled) {
	const reporter = new Reporter(send, (message: string): void => {
		send(message)
	})
	reporter.setFilter(match)
	worker(avaSetup, {
		reporter,
		logger: send
	}).then((): void => {
		process.exitCode = 0
	}).catch(handler).finally((): void => {
		reporter.endRun()
	})
} else {
	const reporter = new Reporter(send)
	reporter.setFilter(match)
	worker(avaSetup, {
		reporter
	}).then((): void => {
		process.exitCode = 0
	}).catch(handler).finally((): void => {
		reporter.endRun()
	})
}
