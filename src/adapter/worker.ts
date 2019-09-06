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
import Emitter from 'emittery'
import { Client, ClientSocket, NetworkError } from 'veza'
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
	Ready,
} from '../ipc'

/** The timeout duration for the worker in milliseconds. */
const timeout = 30000

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

/** Single occurance events. */
type Single = 'exit' | 'connect' | 'disconnect'
/** Worker console output events. */
type Output = 'stdout' | 'stderr'
/** The Worker event types. */
type Events = 'error' | Output | 'prefix' | 'file' | 'case' | 'result' | 'done' | 'ready'

/** Worker Event Handler type. */
type Handler = (_: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any

/** Manages a worker process. */
export class Worker {
	/** The child process. */
	private readonly child: ChildProcess
	/** The veza connection, if connected. */
	private connection?: ClientSocket
	/** The emitter for worker events. */
	private readonly emitter = new Emitter.Typed<
		{
			stdout: Buffer | string
			stderr: Buffer | string
			error: Error | NetworkError
			prefix: Prefix
			file: TestFile
			case: TestCase
			result: Result
			ready: Ready
			done: string
			exit: Worker
			connect: Worker
			disconnect: Worker
		},
		Events | Single
	>()
	/** Indicates if the worker has exited. */
	private alive = true
	/** Stores exit event. */
	private readonly onExit = this.emitter.once('exit')
	/** Stores connect event. */
	private readonly onConnect = this.emitter.once('connect')
	/** Stores disconnect event. */
	private readonly onDisconnect = this.emitter.once('disconnect')

	/** The exit code of the worker process. */
	private code: number | null = null
	/** Gets the exit code of the worker process. */
	public get exitCode(): number | null {
		return this.code
	}

	/**
	 * Constructor.
	 * @param config The worker configuration.
	 * @param script The worker script file.
	 */
	public constructor(config: WorkerConfig, script = './child.js') {
		const emitter = this.emitter
		this.onExit.then(() => {
			this.alive = false
			emitter.clearListeners()
		})
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
		).once('exit', (code): void => {
			this.code = code
			emitter.emit('exit', this)
		})
		const child = this.child
		if (child.stdout) {
			child.stdout.on('data', emitter.emit.bind(emitter, 'stdout'))
		}
		if (child.stderr) {
			child.stderr.on('data', emitter.emit.bind(emitter, 'stdout'))
		}
		const cleanup = (): void => {
			if (this.alive) {
				child.kill()
			}
		}
		const timer = setTimeout(cleanup, timeout)
		child.once('message', (message: string): void => {
			clearTimeout(timer)
			const s = message.split(':')
			child.disconnect()
			this.connect(Number.parseInt(s[0], 16), s[1])
		})
		this.onExit.then((): void => {
			process.off('beforeExit', cleanup)
		})
		process.once('beforeExit', cleanup)
	}

	/**
	 * Connects to the worker.
	 * @param port The port to connect on.
	 * @param token The name for the veza client.
	 */
	private connect(port: number, token: string): void {
		const emit = this.emitter.emit.bind(this.emitter)
		const cleanup = (): void => {
			if (this.alive) {
				this.child.kill()
			}
		}
		const c = new Client(token, {
			handshakeTimeout: timeout,
		})
			.once('connect', (c): void => {
				this.connection = c
				emit('connect', this)
			})
			.once('disconnect', (): void => {
				this.connection = undefined
				const timer = setTimeout(cleanup, timeout)
				this.onExit.then(clearTimeout.bind(null, timer))
				emit('disconnect', this)
			})
			.on('error', emit.bind('error'))
			.on('message', ({ data }): void => {
				if (typeof data === 'object' && data.type && typeof data.type === 'string') {
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
							emit('ready', m)
							return
						default:
							emit('error', new TypeError(`Invalid message type: ${data.type}`))
							return
					}
				} else {
					emit('error', new TypeError('Worker sent an invalid message.'))
				}
			})
		c.connectTo({ port, host: '127.0.0.1' }).catch((error): void => {
			if (error instanceof Error) {
				this.emitter.emitSerial('error', error)
			} else {
				this.emitter.emitSerial('error', new Error('Worker failed to connect.'))
			}
			cleanup()
		})
	}

	/* eslint no-dupe-class-members: "off" */
	/**
	 * Listen for an event.
	 * @param event The event type to listen for.
	 * @param listener The event listener.
	 */
	public on(
		event: 'error',
		listener: (error: Error | NetworkError) => void,
		remove?: (() => void)[]
	): Worker
	public on(
		event: 'stdout',
		listener: (chunk: Buffer | string) => void,
		remove?: (() => void)[]
	): Worker
	public on(
		event: 'stderr',
		listener: (chunk: Buffer | string) => void,
		remove?: (() => void)[]
	): Worker
	public on(event: 'prefix', listener: (prefix: Prefix) => void, remove?: (() => void)[]): Worker
	public on(event: 'file', listener: (file: TestFile) => void, remove?: (() => void)[]): Worker
	public on(event: 'case', listener: (test: TestCase) => void, remove?: (() => void)[]): Worker
	public on(event: 'result', listener: (result: Result) => void, remove?: (() => void)[]): Worker
	public on(event: 'done', listener: (file: string) => void, remove?: (() => void)[]): Worker
	public on(event: 'ready', listener: (message: Ready) => void, remove?: (() => void)[]): Worker
	public on(event: Events, listener: Handler, remove?: (() => void)[]): Worker {
		if (this.alive) {
			if (remove) {
				remove.push(this.emitter.on(event, listener))
			} else {
				this.emitter.on(event, listener)
			}
		}
		return this
	}

	/**
	 * Listen for an event once.
	 * @param event The event type to listen for.
	 * @param listener The event listener.
	 */
	public once(event: 'error', listener: (error: Error | NetworkError) => void): Worker
	public once(event: 'exit', listener: (worker: Worker) => void): Worker
	public once(event: 'connect', listener: (worker: Worker) => void): Worker
	public once(event: 'disconnect', listener: (worker: Worker) => void): Worker
	public once(event: 'stdout', listener: (chunk: Buffer | string) => void): Worker
	public once(event: 'stderr', listener: (chunk: Buffer | string) => void): Worker
	public once(event: 'prefix', listener: (prefix: Prefix) => void): Worker
	public once(event: 'file', listener: (file: TestFile) => void): Worker
	public once(event: 'case', listener: (test: TestCase) => void): Worker
	public once(event: 'result', listener: (result: Result) => void): Worker
	public once(event: 'ready', listener: (message: Ready) => void): Worker
	public once(event: Events | Single, listener: Handler): Worker {
		switch (event) {
			case 'exit':
				this.onExit.then(listener)
				break
			case 'connect':
				this.onConnect.then(listener)
				break
			case 'disconnect':
				this.onDisconnect.then(listener)
				break
			default:
				if (this.alive) {
					this.emitter.once(event).then(listener)
				}
				break
		}
		return this
	}

	/**
	 * Removes a listener.
	 * @param event The event to remove a listener for.
	 * @param listener The listener to remove.
	 * @returns this
	 */
	public off(event: 'error', listener: (error: Error | NetworkError) => void): Worker
	public off(event: 'stdout', listener: (chunk: Buffer | string) => void): Worker
	public off(event: 'stderr', listener: (chunk: Buffer | string) => void): Worker
	public off(event: 'prefix', listener: (prefix: Prefix) => void): Worker
	public off(event: 'file', listener: (file: TestFile) => void): Worker
	public off(event: 'case', listener: (test: TestCase) => void): Worker
	public off(event: 'result', listener: (result: Result) => void): Worker
	public off(event: 'ready', listener: (message: Ready) => void): Worker
	public off(event: Events, listener: Handler): Worker {
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
		} else if (this.alive) {
			this.emitter.once('connect').then((): void => {
				setImmediate(this.disconnect.bind(this))
			})
		}
	}
}
