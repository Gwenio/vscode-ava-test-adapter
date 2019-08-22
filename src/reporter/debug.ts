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

import getPort from 'get-port'
import AVA from 'ava/namespace'
import AbstractReporter from './reporter'

type Logger = (message: string) => void
type Ready = (port: number) => void

export default class DebugReporter extends AbstractReporter {
	private readonly ready: Ready
	private readonly log: Logger = (_message: string): void => { }
	private readonly defaultPort: number
	private port: number
	private static running = false

	public constructor(ready: Ready, port: number, log?: Logger) {
		super()
		this.ready = ready
		this.defaultPort = port
		this.port = port
		if (log) {
			this.log = log
		}
	}

	public async selectPort(): Promise<number> {
		const p = await getPort({ port: this.defaultPort })
		this.port = p
		return p
	}

	public startRun(plan: AVA.Plan): void {
		if (DebugReporter.running) {
			throw new Error('Cannot start a new debugging session while another is in progress.')
		}
		DebugReporter.running = true
		super.startRun(plan)
		this.log('Begin Run.')
		this.ready(this.port)
	}

	/* eslint @typescript-eslint/no-empty-function: "off" */
	public consumeStateChange(_event: AVA.Event): void { }

	public endRun(): void {
		if (DebugReporter.running) {
			DebugReporter.running = false
			this.log('Run Complete.')
		}
	}
}
