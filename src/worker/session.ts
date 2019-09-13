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

import { Event } from '../ipc'

/** Represents a test run session. */
export default class Session {
	/** The callback to send test results for the session. */
	public readonly send: (event: Event) => void

	/** Set of interrupt callbacks. */
	private readonly interrupts = new Set<() => void>()

	/** Indicates if the session has yet to be stopped. */
	private active = true

	/**
	 * Constructor.
	 * @param send The send callback for the session.
	 */
	constructor(send: (event: Event) => void) {
		this.send = send
	}

	/** Stops the session. */
	public stop(): void {
		if (this.active) {
			this.active = false
			this.interrupts.forEach(setImmediate)
			this.interrupts.clear()
		}
	}

	/**
	 * Adds an interrupt callback to the session.
	 * @param i The interrupt callback to add.
	 */
	public add(i: () => void): void {
		if (this.active) {
			this.interrupts.add(i)
		} else {
			i()
		}
	}

	/**
	 * Removes an interrupt callback to the session.
	 * @param i The interrupt callback to remove.
	 */
	public remove(i: () => void): void {
		if (this.active) {
			this.interrupts.delete(i)
		}
	}
}
