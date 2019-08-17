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
import { Client, ClientSocket } from 'veza'
import {
	Parent,
	Load,
	Run,
	Debug,
	Drop,
	Stop,
	Child,
	Prefix,
	TestCase,
	TestFile,
	Result,
	Logging,
	Port
} from './ipc'

const script = './child.js'

interface WorkerConfig {
	cwd: string;
	environment: NodeJS.ProcessEnv;
	nodePath: string | undefined;
	nodeArgv: string[];
}

type Basic = 'error' | 'exit' | 'message' | 'connect' | 'disconnect'
type Output = 'stdout' | 'stderr'
type Events = Basic | Output | 'prefix' | 'file' | 'case' | 'result' | 'done' | 'ready'

export class Worker {
	private readonly child: ChildProcess
	private connection?: ClientSocket
	private readonly emitter: Emitter = new Emitter()

	public constructor(config: WorkerConfig, resolve: () => void) {
		const emitter = this.emitter
		this.child = fork(
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
		const child = this.child
		if (child.stdout) {
			child.stdout.on('data', emitter.emit.bind(emitter, 'stdout'))
		}
		if (child.stderr) {
			child.stderr.on('data', emitter.emit.bind(emitter, 'stderr'))
		}
		const timer = setTimeout((): void => {
			child.kill()
			resolve()
		}, 30000)
		child.once('message', (message: string): void => {
			clearTimeout(timer)
			const s = message.split(':')
			child.disconnect()
			this.connect(Number.parseInt(s[0], 16), s[1], resolve)
		})
	}

	private connect(port: number, token: string, resolve: () => void): void {
		const c = new Client(token)
			.once('connect', (c): void => {
				this.connection = c
				this.emitter.emit('connect')
			})
			.once('disconnect', (): void => {
				this.connection = undefined
				this.emitter.emit('disconnect')
			})
			.on('error', this.emitter.emit.bind(this.emitter, 'error'))
			.on('message', ({ data }): void => {
				const emit: (event: Events,
					message?: string | Prefix | TestFile | TestCase | Result | Error) => void =
					this.emitter.emit.bind(this.emitter)
				if (typeof data === 'string') {
					emit('message', data)
				} else if (typeof data === 'object' && data.type && typeof data.type === 'string') {
					const m = data as Child
					switch (m.type) {
						case 'prefix':
							emit('prefix', m)
							return
						case 'file':
							emit('file', m)
							return
						case 'case':
							emit('case', m)
							return
						case 'result':
							emit('result', m)
							return
						case 'done':
							emit('done', m.file)
							return
						case 'ready':
							emit('ready')
							return
						default:
							emit('error', new TypeError(`Invalid message type: ${data.type}`))
							return
					}
				} else {
					emit('error', new TypeError('Worker sent an invalid message.'))
				}
			})
		c.connectTo({ port }).finally(resolve)
	}

	/* eslint no-dupe-class-members: "off" */
	public on(event: 'error', handler: (error: Error) => void): Worker
	public on(event: 'exit', handler: (code: number | null) => void): Worker
	public on(event: 'message', handler: (message: string) => void): Worker
	public on(event: 'connect', handler: () => void): Worker
	public on(event: 'disconnect', handler: () => void): Worker
	public on(event: 'stdout', handler: (chunk) => void): Worker
	public on(event: 'stderr', handler: (chunk) => void): Worker
	public on(event: 'prefix', handler: (prefix: Prefix) => void): Worker
	public on(event: 'file', handler: (file: TestFile) => void): Worker
	public on(event: 'case', handler: (test: TestCase) => void): Worker
	public on(event: 'result', handler: (result: Result) => void): Worker
	public on(event: 'done', handler: (file: string) => void): Worker
	public on(event: 'ready', handler: () => void): Worker
	public on(event: Events, handler: (...args) => void): Worker {
		this.emitter.on(event, handler)
		return this
	}

	public once(event: 'error', handler: (error: Error) => void): Worker
	public once(event: 'exit', handler: (code: number | null) => void): Worker
	public once(event: 'message', handler: (message: string) => void): Worker
	public once(event: 'connect', handler: () => void): Worker
	public once(event: 'disconnect', handler: () => void): Worker
	public once(event: 'stdout', handler: (chunk) => void): Worker
	public once(event: 'stderr', handler: (chunk) => void): Worker
	public once(event: 'prefix', handler: (prefix: Prefix) => void): Worker
	public once(event: 'file', handler: (file: TestFile) => void): Worker
	public once(event: 'case', handler: (test: TestCase) => void): Worker
	public once(event: 'result', handler: (result: Result) => void): Worker
	public once(event: 'ready', handler: () => void): Worker
	public once(event: Events, handler: (...args) => void): Worker {
		this.emitter.once(event, handler)
		return this
	}

	public removeAllListeners(): Worker {
		this.emitter.removeAllListeners()
		return this
	}

	public off(event: Events, listener: (...a) => void): Worker {
		this.emitter.off(event, listener)
		return this
	}

	public send(message: Load | Run | Debug): Promise<void>
	public send(message: Drop | Stop | Logging | Port): void
	public send(message: Parent): void | Promise<void> {
		const c = this.connection
		if (c) {
			switch (message.type) {
				case 'debug':
				case 'run':
				case 'load':
					return c.send(message, {
						receptive: true
					}).then((): void => { })
				default:
					c.send(message, {
						receptive: false
					})
					return
			}
		} else {
			this.emitter.emit('error', new Error('Attempted to send over a closed connection.'))
		}
	}

	public disconnect(): void {
		const c = this.connection
		if (c) {
			c.disconnect()
		}
	}
}
