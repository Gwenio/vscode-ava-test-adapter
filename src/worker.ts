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

import { ChildProcess, fork } from 'child_process'
import Emitter from 'events'
import { Parent, Child, Prefix, TestCase, TestFile, Result } from './ipc'

const script = './child'

interface WorkerConfig {
	cwd: string;
	environment: NodeJS.ProcessEnv;
	nodePath: string | undefined;
	nodeArgv: string[];
}

type Basic = 'error' | 'exit' | 'message' | 'disconnect'
type Output = 'stdout' | 'stderr'
type Events = Basic | Output | 'prefix' | 'file' | 'case' | 'result' | 'done' | 'end'

export class Worker {
	private child?: ChildProcess
	private readonly emitter: Emitter = new Emitter()
	private queue = Promise.resolve()
	private halt?: () => void

	public constructor() {
		const emitter = this.emitter
		const end = (): void => {
			if (this.halt) {
				this.halt
				this.halt = undefined
			}
		}
		emitter.on('exit', end)
		emitter.on('disconnect', end)
		emitter.on('end', end)
	}

	public connect(config: WorkerConfig): void {
		const child = fork(
			/* eslint node/no-missing-require: "off" */
			require.resolve(script),
			[],
			{
				/* eslint unicorn/prevent-abbreviations: "off" */
				cwd: config.cwd,
				env: config.environment,
				execPath: config.nodePath,
				execArgv: config.nodeArgv,
				stdio: ['pipe', 'pipe', 'pipe', 'ipc']
			}
		)
		if (child.stdout) {
			child.stdout.on('data', this.emitter.emit.bind(this.emitter, 'stdout'))
		}
		if (child.stderr) {
			child.stderr.on('data', this.emitter.emit.bind(this.emitter, 'stderr'))
		}
		child.on('exit', (code): void => {
			this.child = undefined
			this.emitter.emit('exit', code)
		})
		child.on('disconnect', (): void => {
			this.child = undefined
			this.emitter.emit('disconnect')
		})
		child.on('error', this.emitter.emit.bind(this.emitter, 'error'))
		child.on('message', (message: string | Child): void => {
			const emit: (event: Events,
				message?: string | Prefix | TestFile | TestCase | Result | Error) => void =
				this.emitter.emit.bind(this.emitter)
			if (typeof message === 'string') {
				emit('message', message)
			} else {
				switch (message.type) {
					case 'prefix':
						emit('prefix', message)
						return
					case 'file':
						emit('file', message)
						return
					case 'case':
						emit('case', message)
						return
					case 'result':
						emit('result', message)
						return
					case 'done':
						emit('done', message.file)
						return
					case 'end':
						emit('end')
						return
					default:
						emit('error', new TypeError('Worker sent an invalid message.'))
						return
				}
			}
		})
	}

	/* eslint no-dupe-class-members: "off" */
	public on(event: 'error', handler: (error: Error) => void): Worker
	public on(event: 'exit', handler: (code: number | null) => void): Worker
	public on(event: 'message', handler: (message: string) => void): Worker
	public on(event: 'disconnect', handler: () => void): Worker
	public on(event: 'stdout', handler: (chunk) => void): Worker
	public on(event: 'stderr', handler: (chunk) => void): Worker
	public on(event: 'prefix', handler: (prefix: Prefix) => void): Worker
	public on(event: 'file', handler: (file: TestFile) => void): Worker
	public on(event: 'case', handler: (test: TestCase) => void): Worker
	public on(event: 'result', handler: (result: Result) => void): Worker
	public on(event: 'done', handler: (file: string) => void): Worker
	public on(event: 'end', handler: () => void): Worker
	public on(event: Events, handler: (...args) => void): Worker {
		this.emitter.on(event, handler)
		return this
	}

	public once(event: 'error', handler: (error: Error) => void): Worker
	public once(event: 'exit', handler: (code: number | null) => void): Worker
	public once(event: 'message', handler: (message: string) => void): Worker
	public once(event: 'disconnect', handler: () => void): Worker
	public once(event: 'stdout', handler: (chunk) => void): Worker
	public once(event: 'stderr', handler: (chunk) => void): Worker
	public once(event: 'prefix', handler: (prefix: Prefix) => void): Worker
	public once(event: 'file', handler: (file: TestFile) => void): Worker
	public once(event: 'case', handler: (test: TestCase) => void): Worker
	public once(event: 'result', handler: (result: Result) => void): Worker
	public once(event: 'end', handler: () => void): Worker
	public once(event: Events, handler: (...args) => void): Worker {
		this.emitter.once(event, handler)
		return this
	}

	public send(message: Parent): void {
		const child = this.child
		if (child) {
			child.send(message)
		} else {
			this.emitter.emit('error', new Error('Process closed before a message was sent.'))
		}
	}

	public enque(task: () => void | Promise<void>, handle: (error: Error) => void): Promise<void> {
		this.queue = this.queue.then((): Promise<void> => {
			const child = this.child
			if (child) {
				const end = new Promise<void>((resolve): void => {
					this.halt = resolve
				})
				this.queue = end
				task()
				return end
			} else {
				throw new Error('Cannot enque without a worker.')
			}
		}).catch(handle)
		return this.queue
	}

	public get alive(): boolean {
		return this.child ? true : false
	}

	public disconnect(): void {
		if (this.child) {
			this.child.disconnect()
			this.child = undefined
		}
	}
}
