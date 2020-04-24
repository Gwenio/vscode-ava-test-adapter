/*
ISC License (ISC)

Copyright 2019-2020 James Adam Armstrong

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
// eslint-disable-next-line node/no-missing-import
import AVA from 'ava/namespace'
import { Logger, noLog } from './log'

/** Callback type to signal the tests are ready to be debugged. */
type Ready = (port: number) => void

/** Reporter for debugging tests. */
export default class DebugReporter implements AVA.Reporter {
	/** Callback to signal the tests are ready to be debugged. */
	private readonly ready: Ready

	/** Logging callback. */
	private readonly log: Logger = noLog

	/** The preferred port for the debugger to connect on. */
	private readonly defaultPort: number

	/** The port for the next debug session */
	private port: number

	/** Tracks if there is an active run. */
	private static running = false

	/**
	 * Constructor.
	 * @param ready Callback to signal the tests are ready to be debugged.
	 * @param port The preferred port for the debugger to connect on.
	 * @param log The logging callback.
	 */
	public constructor(ready: Ready, port: number, log?: Logger) {
		this.ready = ready
		this.defaultPort = port
		this.port = port
		if (log) {
			this.log = log
		}
	}

	/** Selects a port for the next debug session. */
	public async selectPort(): Promise<number> {
		const p = await getPort({ port: this.defaultPort })
		this.port = p
		return p
	}

	/**
	 * Begins a new run.
	 * @param plan The test plan for the run.
	 */
	public startRun(_plan: AVA.Plan): void {
		if (DebugReporter.running) {
			throw new Error('Cannot start a new debugging session while another is in progress.')
		} else {
			DebugReporter.running = true
			this.log('Begin Debug Run.')
			this.ready(this.port)
		}
	}

	/** Signals the current run has ended. */
	public endRun(): void {
		if (DebugReporter.running) {
			DebugReporter.running = false
			this.log('Debug Run Complete.')
		}
	}
}
