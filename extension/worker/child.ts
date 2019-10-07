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

import { Server, ServerSocket } from 'veza'
import getPort from 'get-port'
import random from 'prando'
import is from '@sindresorhus/is'
import * as IPC from '~ipc/messages'
import hash from './src/hash'
import Suite from './src/suite'
import { isMessage, isLogging, isLoad, isDrop, isRun, isDebug } from '~ipc/validate'

/** The connected client. */
let client: ServerSocket | null = null
/** The name for the parent's veza Client. */
const token = hash(
	process.cwd(),
	(): boolean => false,
	(h): string =>
		process.cwd().length.toString(16) + h + new random(h).nextInt(0, 0xffff).toString(16)
)
/** Whether logging is enabled. */
let logEnabled = process.env.NODE_ENV !== 'production'

/** The suite for managing AVA configurations. */
const suite = new Suite()

/**
 * Loads test information.
 * @param info The Load message begin handled.
 * @param socket The socket to send messages too.
 */
async function loadTests(info: IPC.Load, socket: ServerSocket): Promise<void> {
	const logger = logEnabled ? console.log : undefined
	const wait: Promise<unknown>[] = []
	const send = (data: IPC.Tree): void => {
		wait.push(
			socket.send(data, {
				receptive: false,
			})
		)
	}
	await suite.load(info.file, send, logger)
	await Promise.all(wait)
}

/**
 * Runs tests.
 * @param info The Run message being handled.
 * @param id The session ID.
 * @param socket The socket to send messages too.
 */
async function runTests(info: IPC.Run, id: number, socket: ServerSocket): Promise<void> {
	const logger = logEnabled ? console.log : undefined
	const wait: Promise<unknown>[] = []
	const send = (data: IPC.Event): void => {
		wait.push(
			socket.send(data, {
				receptive: false,
			})
		)
	}
	await suite.run(send, id, info.run, logger)
	await Promise.all(wait)
}

/**
 * Debugs tests.
 * @param info The Debug message being handled.
 * @param socket The socket to send messages too.
 */
async function debugTests(info: IPC.Debug, socket: ServerSocket): Promise<void> {
	const logger = logEnabled ? console.log : undefined
	await suite.debug(
		function(config: string, port: number): void {
			socket.send({
				type: 'ready',
				config,
				port,
			})
		},
		info.run,
		info.port,
		info.serial,
		logger
	)
}

/** The veza server. Constructed externally. */
declare const connection: Server
connection
	.on('error', (error, socket): void => {
		if (socket) {
			console.error(`[IPC] Error from ${socket.name}:`, error)
		} else {
			console.error(error)
		}
	})
	.on('connect', (socket): void => {
		if (socket.name === token) {
			if (client) {
				socket.disconnect(true)
				console.error('[Worker] Another connection was attempted.')
			} else {
				client = socket
				if (logEnabled) {
					console.log('[Worker] Connected.')
				}
			}
		} else {
			socket.disconnect(true)
			console.error(`[Worker] Connection attempt with: ${socket.name}`)
		}
	})
	.on('disconnect', (socket): void => {
		if (socket.name === token && client) {
			socket.server.close()
		}
	})
	.on(
		'message',
		async (message, socket): Promise<void> => {
			if (socket !== client) {
				if (message.receptive) {
					message.reply(null)
				}
				return
			}
			const data = message.data
			try {
				if (isMessage(data)) {
					switch (data.type) {
						case 'log':
							if (isLogging(data)) {
								console.log(`[Worker] Setting logging: ${data.enable}`)
								logEnabled = data.enable
							}
							return
						case 'load':
							if (isLoad(data)) {
								await loadTests(data, socket)
							}
							return
						case 'drop':
							if (isDrop(data)) {
								suite.drop(data.id)
							}
							return
						case 'run':
							if (isRun(data)) {
								await runTests(data, message.id, socket)
							}
							return
						case 'stop':
							suite.cancel()
							return
						case 'debug':
							if (isDebug(data)) {
								await debugTests(data, socket)
							}
							return
						default:
							throw new TypeError(`Invalid message type: ${data.type}`)
					}
				} else if (data !== socket.name) {
					if (process.env.NODE_ENV !== 'production') {
						console.debug(JSON.stringify(data))
					}
					throw new TypeError('Invalid message.')
				}
			} catch (error) {
				if (is.error(error)) {
					console.error(`[Worker] [ERROR] ${error.message}`)
				} else if (is.string(error)) {
					console.error(`[Worker] [ERROR] ${error}`)
				}
			} finally {
				if (message.receptive) {
					message.reply(null)
				}
			}
		}
	)

/** Called to begin serving the connection. */
async function serve(): Promise<void> {
	const port = await getPort()
	try {
		if (logEnabled) {
			console.log(`[Worker] Will listen on port: ${port}`)
		}
		await connection.listen(port, '127.0.0.1')
		if (process.send) {
			process.send(`${port.toString(16)}:${token}`)
		} else {
			console.error('[Worker] Could not send the token to the parent.')
			connection.close()
			process.exitCode = 1
		}
	} catch (error) {
		console.error('[Worker] Failed to establish IPC.', error)
		process.exitCode = 1
	}
}

serve()
