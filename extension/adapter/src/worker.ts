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
import { Writable, Readable } from 'stream'
import Emitter from 'emittery'
import Cancelable from 'p-cancelable'
import { Client, ClientSocket, NetworkError } from 'veza'
import { Parent, Prefix, TestCase, TestFile, Result, Ready } from '~ipc/messages'
import {
	isMessage,
	isPrefix,
	isDone,
	isTestFile,
	isTestCase,
	isResult,
	isReady,
} from '~ipc/validate'

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
	/** How long to wait for the worker process in milliseconds. */
	timeout: number
}

/** Single occurance events. */
type Single = 'exit' | 'connect' | 'begin' | 'disconnect'
/** The Worker event types. */
type Events = 'error' | 'prefix' | 'file' | 'case' | 'result' | 'done' | 'ready'

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
			error: Error | NetworkError
			prefix: Prefix
			file: TestFile
			case: TestCase
			result: Result
			ready: Ready
			done: string
			exit: Worker
			connect: Worker
			begin: Worker
			disconnect: Worker
		},
		Events | Single
	>()
	/** Indicates if the worker has exited. */
	private alive = true
	/** How long to wait on the worker process in milliseconds. */
	private readonly timeout: number
	/** Stores exit event. */
	private readonly onExit = this.emitter.once('exit')
	/** Stores connect event. */
	private readonly onConnect = this.onceHandler('connect')
	/** Stores begin event. */
	private readonly onBegin = this.onceHandler('begin')
	/** Stores disconnect event. */
	private readonly onDisconnect = this.onceHandler('disconnect')
	/** The exit code of the worker process. */
	private code: number | null = null
	/** Gets the exit code of the worker process. */
	public get exitCode(): number | null {
		return this.code
	}

	/**
	 * Constructor.
	 * @param config The worker configuration.
	 * @param stream The stream to forward worker output to.
	 * @param script The worker script file.
	 */
	public constructor(config: WorkerConfig, stream: Writable, script = './child.js') {
		this.timeout = config.timeout
		const emitter = this.emitter
		this.onExit.then(() => {
			this.alive = false
			this.onConnect.cancel()
			this.onBegin.cancel()
			this.onDisconnect.cancel()
			emitter.clearListeners()
			this.child.removeAllListeners()
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
				stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
			}
		)
			.once('exit', (code): void => {
				this.code = code
				emitter.emit('exit', this)
			})
			.once('message', (message: string): void => {
				const s = message.split(':')
				this.child.disconnect()
				this.connect(Number.parseInt(s[0], 16), s[1])
			})
		const { stdout, stderr } = this.child
		const pipe = Worker.pipe.bind(null, stream)
		pipe(stderr)
		pipe(stdout)
		const cleanup = this.cleanup.bind(this)
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
		const cleanup = this.cleanup.bind(this)
		const c = new Client(token, {
			handshakeTimeout: this.timeout,
		})
			.once('connect', (socket): void => {
				this.connection = socket
				emit('connect', this)
			})
			.once('disconnect', (socket): void => {
				this.connection = undefined
				const timer = setTimeout(cleanup, this.timeout)
				this.onExit.then(clearTimeout.bind(null, timer))
				emit('disconnect', this)
				socket.client.removeAllListeners()
			})
			.once('ready', (socket): void => {
				socket.client.on('message', (message): void => {
					const { data } = message
					if (isMessage(data)) {
						try {
							switch (data.type) {
								case 'prefix':
									if (isPrefix(data)) emit('prefix', data)
									return
								case 'file':
									if (isTestFile(data)) emit('file', data)
									return
								case 'case':
									if (isTestCase(data)) emit('case', data)
									return
								case 'result':
									if (isResult(data)) emit('result', data)
									return
								case 'done':
									if (isDone(data)) emit('done', data.file)
									return
								case 'ready':
									if (isReady(data)) emit('ready', data)
									return
								default:
									throw new TypeError(`Invalid message type: ${data.type}`)
							}
						} catch (error) {
							emit('error', error)
							/* istanbul ignore next */
							if (message.receptive) {
								message.reply(null)
							}
						}
					} else {
						emit('error', new TypeError('Worker sent an invalid message.'))
						/* istanbul ignore next */
						if (message.receptive) {
							message.reply(null)
						}
					}
				})
				emit('begin', this)
			})
			.on('error', emit.bind('error'))
		c.connectTo({ port, host: '127.0.0.1' }).catch((error): void => {
			/* istanbul ignore next */
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
	public on(event: 'prefix', listener: (prefix: Prefix) => void, remove?: (() => void)[]): Worker
	public on(event: 'file', listener: (file: TestFile) => void, remove?: (() => void)[]): Worker
	public on(event: 'case', listener: (test: TestCase) => void, remove?: (() => void)[]): Worker
	public on(event: 'result', listener: (result: Result) => void, remove?: (() => void)[]): Worker
	public on(event: 'done', listener: (file: string) => void, remove?: (() => void)[]): Worker
	public on(event: 'ready', listener: (message: Ready) => void, remove?: (() => void)[]): Worker
	public on(event: Events, listener: Handler, remove?: (() => void)[]): Worker {
		/* istanbul ignore else */
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
	public once(event: 'exit', listener: (worker: Worker) => void): Worker
	public once(event: 'connect', listener: (worker: Worker | null) => void): Worker
	public once(event: 'begin', listener: (worker: Worker | null) => void): Worker
	public once(event: 'disconnect', listener: (worker: Worker | null) => void): Worker
	public once(event: Single, listener: Handler): Worker {
		switch (event) {
			case 'exit':
				this.onExit.then(listener)
				break
			case 'connect':
				this.onConnect.then(
					listener,
					/* istanbul ignore next */
					(): void => {
						listener(null)
					}
				)
				break
			case 'begin':
				this.onBegin.then(
					listener,
					/* istanbul ignore next */
					(): void => {
						listener(null)
					}
				)
				break
			case 'disconnect':
				this.onDisconnect.then(
					listener,
					/* istanbul ignore next */
					(): void => {
						listener(null)
					}
				)
				break
		}
		return this
	}

	/**
	 * Get a Promise for a on time event.
	 * @param event The event wait for.
	 * @returns `this` if event occurs before exit, `null` otherwise.
	 */
	public when(event: 'exit'): Promise<Worker>
	public when(event: 'connect'): Promise<Worker | null>
	public when(event: 'begin'): Promise<Worker | null>
	public when(event: 'disconnect'): Promise<Worker | null>
	public when(event: Single): Promise<Worker | null> {
		switch (event) {
			case 'exit':
				return this.onExit
			case 'connect':
				return this.onConnect.catch((): null => null)
			case 'begin':
				return this.onBegin.catch((): null => null)
			case 'disconnect':
				return this.onDisconnect.catch((): null => null)
		}
	}

	/**
	 * Removes a listener.
	 * @param event The event to remove a listener for.
	 * @param listener The listener to remove.
	 * @returns this
	 */
	public off(event: 'error', listener: (error: Error | NetworkError) => void): Worker
	public off(event: 'prefix', listener: (prefix: Prefix) => void): Worker
	public off(event: 'file', listener: (file: TestFile) => void): Worker
	public off(event: 'case', listener: (test: TestCase) => void): Worker
	public off(event: 'result', listener: (result: Result) => void): Worker
	public off(event: 'ready', listener: (message: Ready) => void): Worker
	public off(event: Exclude<Events, Single>, listener: Handler): Worker {
		this.emitter.off(event, listener)
		return this
	}

	/**
	 * Sends a message to the worker.
	 * @param message The message to send.
	 * @returns A promise to await for the triggered action to complete.
	 */
	public send(message: Parent): Promise<unknown> {
		const c = this.connection
		if (c) {
			switch (message.type) {
				case 'debug':
				case 'run':
				case 'load':
					return c.send(message, {
						receptive: true,
					})
				default:
					return c.send(message, {
						receptive: false,
					})
			}
		} else {
			this.emitter.emit('error', new Error('Attempted to send over a closed connection.'))
			return Promise.resolve()
		}
	}

	/** Disconnects the worker. */
	public disconnect(): void {
		const c = this.connection
		if (c) {
			c.disconnect()
		} else this.cleanup()
	}

	/** Kills the child process, if it is alive. */
	private cleanup(): void {
		/* istanbul ignore else */
		if (this.alive) {
			this.child.kill()
		}
	}

	/**
	 * Sets up a pipe between streams.
	 * @param sink The target stream.
	 * @param source The stream to pipe to sink.
	 */
	private static pipe(sink: Writable, source: Readable | null): void {
		/* istanbul ignore else */
		if (source) {
			source
				.pipe(
					sink,
					{ end: false }
				)
				.once('end', source.unpipe.bind(source, sink))
		}
	}

	/**
	 * Prepares a cancelable one time event handler.
	 * @param event The event to handle once.
	 */
	private onceHandler(event: Single): Cancelable<Worker> {
		return new Cancelable<Worker>((resolve, _reject, onCancel): void => {
			const off = this.emitter.on(event, (data): void => {
				off()
				resolve(data)
			})
			onCancel.shouldReject = true
			onCancel(off)
		})
	}
}
