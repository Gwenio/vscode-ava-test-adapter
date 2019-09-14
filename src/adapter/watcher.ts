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

import Emitter from 'emittery'
import Log from './log'

/** Disposable interface. */
interface IDisposable {
	/** Dispose of the object. */
	dispose(): void
}

/** Manages file change events. */
export default class Watcher implements IDisposable {
	/** Internal event emitter. */
	private readonly emitter = new Emitter.Typed<{ changed: string }, 'run' | 'load'>()
	/** The set of files to watch for changes. */
	private files = new Set<string>()
	/** Indicates if the watcher is inactive. */
	private idle = true

	/**
	 * Constructor.
	 * @param log The Log to use.
	 * @param workPath The path to the root of the workspace.
	 */
	public constructor(log: Log, workPath: string) {
		this.emitter.on(
			'changed',
			async (filename): Promise<void> => {
				if (this.idle) return
				if (log.enabled) {
					log.info(`${filename} was saved - checking if this affects ${workPath}`)
				}
				if (this.files.has(filename)) {
					if (log.enabled) {
						log.info(`Sending reload event because ${filename} was saved.`)
					}
					this.emitter.emit('load')
				} else if (filename.startsWith(workPath)) {
					log.info('Sending autorun event')
					this.emitter.emit('run')
				}
			}
		)
	}

	/**
	 * @override
	 * @inheritdoc
	 */
	public dispose(): void {
		this.emitter.clearListeners()
		this.clear()
	}

	/**
	 * Subscribes a listener to an event.
	 * @param event The event to subscribe to.
	 * @param listener The listener to attach to the event.
	 */
	public on(event: 'load' | 'run', listener: () => void): Watcher {
		this.emitter.on(event, listener)
		return this
	}

	/**
	 * Signals that a file change has occured.
	 * @param file The name of the file that was changed.
	 */
	public changed(file: string): void {
		this.emitter.emitSerial('changed', file)
	}

	/**
	 * Sets whether the Watcher is not idle.
	 * @param value The value to set.
	 */
	public set active(value: boolean) {
		this.idle = !value
	}

	/**
	 * Sets the set of files to watch.
	 * @param list The files to watch.
	 */
	public set watch(list: Set<string>) {
		this.files = list
	}

	/** Clears the list of files being watched. */
	public clear(): void {
		this.files.clear()
	}
}
