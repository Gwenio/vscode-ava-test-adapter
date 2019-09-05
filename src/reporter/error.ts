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
import AVA from 'ava/namespace' // eslint-disable-line node/no-missing-import
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
		if (typeof event === 'object' && event['err']) {
			console.log(JSON.stringify(event['err']))
		}
		switch (event.type) {
			case 'missing-ava-import':
				console.error(`[AVA] [ERROR] No AVA import in: ${this.formatFile(event.testFile)}`)
				return
			case 'internal-error':
				if (event.testFile) {
					console.error(
						`[AVA] [ERROR] AVA Internal Error: ${this.formatFile(event.testFile)}`
					)
				} else {
					console.error('[AVA] [ERROR] AVA Internal Error')
				}
				this.logError(event.err)
				return
			case 'unhandled-rejection':
				console.error(
					`[AVA] [ERROR] Unhandled Rejection: ${this.formatFile(event.testFile)}`
				)
				this.logError(event.err)
				return
			case 'uncaught-exception':
				console.error(
					`[AVA] [ERROR] Uncaught Exception: ${this.formatFile(event.testFile)}`
				)
				this.logError(event.err)
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

	/**
	 * Prepares a file name for printing.
	 * @param file File name to format.
	 */
	private formatFile(file: string): string {
		return path.relative('.', file)
	}

	/**
	 * Logs an error.
	 * @param error The error to log.
	 */
	private logError(error: AVA.Events.ErrorInfo): void {
		if (error.summary) {
			console.error(error.summary)
		} else if (error.message) {
			if (error.name) {
				console.error(`${error.name}: ${error.message}`)
			} else {
				console.error(error.message)
			}
		} else if (error.formatted) {
			console.error(error.formatted)
		}
		if (error.stack) {
			console.error(error.stack)
		}
	}
}
