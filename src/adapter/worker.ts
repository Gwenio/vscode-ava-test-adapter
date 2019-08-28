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
} from '../ipc'

/** The file name of the worker script. */
const script = './child.js'

/** Interface for the configuration of the worker. */
interface WorkerConfig {
	/** The current working directory of the worker. */
	cwd: string
	/** The environment for the worker. */
	environment: NodeJS.ProcessEnv
	/** The path to the NodeJS executable to use. */
	nodePath: string | undefined
	/** The CLI arguments for Node. */
	nodeArgv: string[]
}

/** Basic events. */
type Basic = 'error' | 'exit' | 'message' | 'connect' | 'disconnect'
/** Worker console output events. */
type Output = 'stdout' | 'stderr'
/** The Worker event types. */
type Events = Basic | Output | 'prefix' | 'file' | 'case' | 'result' | 'done' | 'ready'

/** Manages a worker process. */
export class Worker {
	/** The child process. */
	private readonly child: ChildProcess
	/** The veza connection, if connected. */
	private connection?: ClientSocket
	/** The emitter for worker events. */
	private readonly emitter: Emitter = new Emitter()

	/**
	 * Constructor.
	 * @param config The worker configuration.
	 * @param resolve Callback to resolve promise waiting on the worker connection.
	 */
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
				stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
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

	/**
	 * Connects to the worker.
	 * @param port The port to connect on.
	 * @param token The name for the veza client.
	 * @param resolve The resolve callback from the constructor.
	 */
	private connect(port: number, token: string, resolve: () => void): void {
		const emit: (event: Events, ...m) => void = this.emitter.emit.bind(this.emitter)
		const c = new Client(token)
			.once('connect', (c): void => {
				this.connection = c
				emit('connect')
			})
			.once('disconnect', (): void => {
				this.connection = undefined
				emit('disconnect')
			})
			.on('error', this.emitter.emit.bind(this.emitter, 'error'))
			.on('message', ({ data }): void => {
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
							emit('ready', m.config, m.port)
							return
						default:
							emit('error', new TypeError(`Invalid message type: ${data.type}`))
							return
					}
				} else {
					emit('error', new TypeError('Worker sent an invalid message.'))
				}
			})
		c.connectTo({ port, host: '127.0.0.1' }).finally(resolve)
	}

	/* eslint no-dupe-class-members: "off" */
	/**
	 * Listen for an event.
	 * @param event The event type to listen for.
	 * @param handler The event listener.
	 */
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
	public on(event: 'ready', handler: (id: string, port: number) => void): Worker
	public on(event: Events, handler: (...args) => void): Worker {
		this.emitter.on(event, handler)
		return this
	}

	/**
	 * Listen for an event once.
	 * @param event The event type to listen for.
	 * @param handler The event listener.
	 */
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
	public once(event: 'ready', handler: (id: string, port: number) => void): Worker
	public once(event: Events, handler: (...args) => void): Worker {
		this.emitter.once(event, handler)
		return this
	}

	/**
	 * Removes all listeners on emitter.
	 * @returns this
	 */
	public removeAllListeners(): Worker {
		this.emitter.removeAllListeners()
		return this
	}

	/**
	 * Removes a listener.
	 * @param event The event to remove a listener for.
	 * @param listener The listener to remove.
	 * @returns this
	 */
	public off(event: Events, listener: (...a) => void): Worker {
		this.emitter.off(event, listener)
		return this
	}

	/**
	 * Sends a message to the worker.
	 * @param message The message to send.
	 * @returns A promise to await for the triggered action to complete.
	 */
	public send(message: Load | Run | Debug): Promise<void>
	/**
	 * Sends a message to the worker.
	 * @param message The message to send.
	 */
	public send(message: Drop | Stop | Logging): void
	public send(message: Parent): void | Promise<void> {
		const c = this.connection
		if (c) {
			switch (message.type) {
				case 'debug':
				case 'run':
				case 'load':
					return c
						.send(message, {
							receptive: true,
						})
						.then((): void => {})
				default:
					c.send(message, {
						receptive: false,
					})
					return
			}
		} else {
			this.emitter.emit('error', new Error('Attempted to send over a closed connection.'))
		}
	}

	/** Disconnects the worker. */
	public disconnect(): void {
		const c = this.connection
		if (c) {
			c.disconnect()
		}
	}
}
