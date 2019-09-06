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
/** Callback to forward the result of a task. */
type Resolver<Result> = (_: Result) => void
/** Task cancellation callback type. */
type Cancel = () => void
/** Type for a packaged task. */
type PackedTask = [() => Promise<void>, Cancel]

/** Generic Queue interface. */
export interface Queue {
	/**
	 * Adds a task to the back of the queue.
	 * @param task The task to place in the Queue.
	 * @returns A Promise that will resolve after the task is run.
	 */
	add<Result>(task: Task<Result>): Promise<Result | void>

	/** Cancel all pending tasks, calling their cancel callbacks. */
	clear(): void
}

/** A Queue that only allows one task to run at a time. */
export class SerialQueue implements Queue {
	/** The pending tasks in the queue. */
	private pending: PackedTask[] = []
	/** Flag for whether their is a task currently running. */
	private idle = true

	/**
	 * @inheritdoc
	 * @override
	 */
	public add<Result>(task: Task<Result>): Promise<Result | void> {
		return new Promise<Result | void>((resolve, reject): void => {
			const packed = this.pack(task, resolve, reject)
			if (this.idle) {
				this.idle = false
				packed()
			} else {
				this.pending.push([packed, resolve])
			}
		})
	}

	/**
	 * @inheritdoc
	 * @override
	 */
	public clear(): void {
		const cancelled = this.pending
		this.pending = []
		cancelled.forEach(([_, c]): void => {
			setImmediate(c)
		})
	}

	/**
	 * Packages a task to be run.
	 * @param task The task to package.
	 * @param resolve Callback to recieve the result of the task.
	 * @param handler The error handler callback for the task.
	 */
	private pack<Result>(
		task: Task<Result>,
		resolve: Resolver<Result>,
		handler: ErrorHandler
	): () => Promise<void> {
		return async (): Promise<void> => {
			try {
				resolve(await task())
			} catch (error) {
				handler(error)
			} finally {
				this.run()
			}
		}
	}

	/** Runs the next pending task, if there is one. */
	private run(): void {
		const x = this.pending.shift()
		if (x) {
			x[0]()
		} else {
			this.idle = true
		}
	}
}
