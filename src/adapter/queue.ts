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

/** Type for tasks begin queued. */
type Task<Result> = (() => PromiseLike<Result>) | (() => Result)
/** Error handler callback type. */
type ErrorHandler = (_: unknown) => void
/** Task cancellation callback type. */
type Cancel = () => void
/** Type for a packaged task. */
type PackedTask = [() => Promise<void>, Cancel]

/** Task options. */
interface Options {
	/** Optional cancellation callback. */
	cancel?: Cancel
	/** Optional error handler callback. */
	handler?: ErrorHandler
}

/** Generic Queue interface. */
export interface Queue<Q> {
	/**
	 * Adds a task to the back of the queue.
	 * @param task The task to place in the Queue.
	 * @returns this
	 */
	add<Result>(task: Task<Result>): Q

	/**
	 * Adds a task to the back of the queue.
	 * @param task The task to place in the Queue.
	 * @param options Optional options for the task.
	 * @returns this
	 */
	add<Result>(task: Task<Result>, options: Options): Q

	/**
	 * Cancel all pending tasks, calling their cancel callbacks.
	 * @returns this
	 */
	clear(): Q
}

/** Fake cancel callback for tasks without one. */
const fakeCancel: Cancel = (): void => {}
/** Fake error handler callback for tasks without one. */
const fakeHandler: ErrorHandler = (_: unknown): void => {}

/** A Queue that only allows one task to run at a time. */
export class SerialQueue implements Queue<SerialQueue> {
	/** The pending tasks in the queue. */
	private pending: PackedTask[] = []
	/** Flag for whether their is a task currently running. */
	private idle = true
	/** The default error handler callback for tasks without one. */
	public defaultHandler = fakeHandler

	/**
	 * Adds a task to the back of the queue.
	 * @param task The task to place in the Queue.
	 * @param options Optional options for the task.
	 * @returns this
	 * @override
	 */
	public add<Result>(task: Task<Result>, options: Options = {}): SerialQueue {
		const h = options.handler
		const packed = this.pack(task, h ? h : this.defaultHandler)
		if (this.idle) {
			this.idle = false
			packed().finally(this.run.bind(this))
		} else {
			const c = options.cancel
			this.pending.push([packed, c ? c : fakeCancel])
		}
		return this
	}

	/**
	 * Cancel all pending tasks, calling their cancel callbacks.
	 * @returns this
	 * @override
	 */
	public clear(): SerialQueue {
		const cancelled = this.pending
		this.pending = []
		cancelled.forEach(([_, c]): void => {
			setImmediate(c)
		})
		return this
	}

	/**
	 * Packages a task to be run.
	 * @param task The task to package.
	 * @param handler The error handler callback for the task.
	 */
	private pack<Result>(task: Task<Result>, handler: ErrorHandler): () => Promise<void> {
		return async (): Promise<void> => {
			try {
				await task()
			} catch (error) {
				handler(error)
			}
		}
	}

	/** Runs the next pending task, if there is one. */
	private run(): void {
		const x = this.pending.shift()
		if (x) {
			x[0]().finally(this.run.bind(this))
		} else {
			this.idle = true
		}
	}
}
