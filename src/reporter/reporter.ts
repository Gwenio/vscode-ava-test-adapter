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

// eslint-disable-next-line node/no-missing-import
import AVA from 'ava/namespace'

/** Callback type for removing a listener. */
type RemoveListener = () => void

/** The base class for reporters. */
export default abstract class Reporter implements AVA.Reporter {
	/** Function to remove current event subscription. */
	private removeListener: null | RemoveListener = null

	/** Resets the Reporter. */
	protected reset(): void {
		if (this.removeListener) {
			this.removeListener()
			this.removeListener = null
		}
	}

	/**
	 * Begins a new run.
	 * @param plan The test plan for the run.
	 */
	public startRun(plan: AVA.Plan): void {
		this.reset()
		this.removeListener = plan.status.on('stateChange', this.consumeStateChange.bind(this))
	}

	/**
	 * Called with a test event occurs during a run.
	 * @param event The test event.
	 */
	protected abstract consumeStateChange(event: AVA.Event): void

	/** Signals the current run has ended. */
	public abstract endRun(): void
}
