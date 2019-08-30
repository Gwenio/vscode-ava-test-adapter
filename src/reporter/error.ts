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

import path from 'path'
import AVA from 'ava/namespace'
import AbstractReporter from './reporter'

/** Reporter for errors. */
export default class ErrorReporter extends AbstractReporter {
	/** The main reporter to use. */
	private readonly sub: AVA.Reporter

	/**
	 * Constructor.
	 * @param r The main reporter to use.
	 */
	public constructor(r: AVA.Reporter) {
		super()
		this.sub = r
	}

	/**
	 * @inheritdoc
	 * @override
	 */
	public startRun(plan: AVA.Plan): void {
		super.startRun(plan)
		this.sub.startRun(plan)
	}

	/**
	 * @inheritdoc
	 * @override
	 */
	protected consumeStateChange(event: AVA.Event): void {
		switch (event.type) {
			case 'missing-ava-import':
				console.error(
					`[Worker] [ERROR] No AVA import in: ${path.relative('.', event.testFile)}`
				)
				return
			case 'internal-error':
				if (event.testFile) {
					console.error(
						`[Worker] [ERROR] AVA Internal Error: ${path.relative('.', event.testFile)}`
					)
				} else {
					console.error('[Worker] [ERROR] AVA Internal Error')
				}
				if (event.err.message) {
					console.error(event.err.message)
				}
				if (event.err.stack) {
					console.error(event.err.stack)
				}
				return
			case 'unhandled-rejection':
				console.error(
					`[Worker] [ERROR] Unhandled Rejection: ${path.relative('.', event.testFile)}`
				)
				if (event.err.message) {
					console.error(event.err.message)
				} else if (event.err.formatted) {
					console.error(event.err.formatted)
				}
				if (event.err.stack) {
					console.error(event.err.stack)
				}
				return
			case 'uncaught-exception':
				console.error(
					`[Worker] [ERROR] Uncaught Exception: ${path.relative('.', event.testFile)}`
				)
				if (event.err.message) {
					console.error(event.err.message)
				} else if (event.err.formatted) {
					console.error(event.err.formatted)
				}
				if (event.err.stack) {
					console.error(event.err.stack)
				}
				return
			case 'interrupt':
				console.error('Test run cancelled.')
				this.endRun()
				return
			case 'timeout':
				console.error('Test run timed out.')
				this.endRun()
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
		this.sub.endRun()
		this.reset()
	}
}
