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

import vscode from 'vscode'
import {
	TestRunStartedEvent,
	TestRunFinishedEvent,
	TestSuiteEvent,
	TestEvent,
	TestInfo
} from 'vscode-test-adapter-api'
import { Log } from 'vscode-test-adapter-util'
import { AVAEvent, AVADone } from './ipc'
import Worker from './worker'

type TestStates = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent

export default class TestWorker extends Worker<string | AVAEvent | AVADone> {
	private readonly testStatesEmitter: vscode.EventEmitter<TestStates>
	private readonly find: (id: string, file: string) => TestInfo | null

	public constructor(l: Log, c: vscode.OutputChannel, t: vscode.EventEmitter<TestStates>,
		f: (id: string, file: string) => TestInfo | null) {
		super(l, c)
		this.testStatesEmitter = t
		this.find = f
	}

	protected messageHandler(message: string | AVAEvent | AVADone): void {
		if (typeof message === 'string') {
			this.log.info(`Run Worker: ${message}`)
		} else if (message.type === 'event') {
			if (this.log.enabled) {
				this.log.info(`Received event ${JSON.stringify(message)}`)
			}
			const info = this.find(message.test, message.file)
			if (info) {
				const event: TestEvent = {
					type: 'test',
					test: info,
					state: message.state
				}
				this.testStatesEmitter.fire(event)
			}
		} else if (message.type === 'done') {
			this.testStatesEmitter.fire({
				type: 'suite',
				state: 'completed',
				suite: message.file
			})
		} else {
			throw new TypeError('Unexpected message from worker.')
		}
	}
}
