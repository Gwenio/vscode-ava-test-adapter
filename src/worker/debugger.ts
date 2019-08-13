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
import Api from 'ava/lib/api'
import { setup } from './ava_setup'
import { worker } from './ava_worker'
import AbstractReporter from './reporter'

type Sender = (message: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
type Logger = (message: string) => void

function parse<T>(index: number, type: string): T {
	const value = JSON.parse(process.argv[index])
	if (typeof value == type) {
		return value as T
	} else {
		throw new TypeError(`Expected process.argv[${index}] to be ${type}, got ${typeof value}`)
	}
}

const logEnabled = parse<boolean>(3, 'boolean')
const prefixSize = parse<number>(4, 'number')
const debuggerPort = parse<number>(5, 'number')
const serialDebug = parse<boolean>(6, 'boolean')
const targetFile = [process.argv[7]]
const testCase = process.argv.length > 8 ? [process.argv[8]] : null

class Reporter extends AbstractReporter {
	private readonly send: (message: 'debug') => void
	private readonly log: Logger = (_message: string): void => { }
	private readonly prefix: number
	private running: boolean = false

	public constructor(send: Sender, prefix: number, log?: Logger) {
		super()
		this.send = send
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
		console.log(JSON.stringify(plan))
		this.log('Begin Run.')
		this.send('debug')
	}

	public consumeStateChange(_event: AVA.Event): void { }

	public endRun(): void {
		if (this.running) {
			this.running = false
			this.log('Run Complete.')
		}
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
	} else {
		console.log(message)
	}
} : null)

if (testCase) {
	avaSetup.match = testCase
}
avaSetup.serial = serialDebug || avaSetup.serial
//avaSetup.testOnlyExecArgv = process.execArgv.concat(`--inspect-brk=${debuggerPort}`)

const send: Sender = (message): void => {
	if (process.send) {
		process.send(message)
	} else if (process.env.NODE_ENV === 'production') {
		throw new TypeError('process.send unavailable')
	} else {
		console.log(message)
	}
}

Api.prototype._computeForkExecArgv = async function (): Promise<string[]> {
	return process.execArgv.concat(`--inspect-brk=${debuggerPort}`)
}

if (logEnabled) {
	const reporter = new Reporter(send, prefixSize, (message: string): void => {
		send(message)
	})
	worker(avaSetup, {
		reporter,
		logger: send,
		files: targetFile
	}).then((status): void => {
		process.exitCode = status.suggestExitCode({ matching: avaSetup.match.length > 0 })
	}).catch(handler).finally((): void => {
		reporter.endRun()
	})
} else {
	const reporter = new Reporter(send, prefixSize)
	worker(avaSetup, {
		reporter,
		files: targetFile
	}).then((status): void => {
		process.exitCode = status.suggestExitCode({ matching: avaSetup.match.length > 0 })
	}).catch(handler).finally((): void => {
		reporter.endRun()
	})
}
