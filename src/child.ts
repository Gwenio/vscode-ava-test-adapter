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

import Emitter from 'events'
import { Server, ServerSocket } from 'veza'
import getPort from 'get-port'
import random from 'random'
import * as IPC from './ipc'
import hash from './hash'
import Suite from './worker/suite'
import { TestResult } from './reporter'

let connected = false
const token = hash(process.cwd(), (): boolean => false,
	process.cwd().length.toString(16),
	random.int(0, 0xFFFF).toString(16))
let logEnabled = process.env.NODE_ENV !== 'production'
//let debuggerPort = 9229

let suite: Suite | null = null

async function loadTests(info: IPC.Load, client: ServerSocket): Promise<void> {
	const logger = logEnabled ? console.log : undefined
	suite = new Suite(info.file, logger)
	await suite.load(logger)
	const wait: Promise<unknown>[] = []
	await suite.collectInfo((data: IPC.Tree): void => {
		wait.push(client.send(data, {
			receptive: false
		}))
	})
	await Promise.all(wait)
}

async function runTests(info: IPC.Run, client: ServerSocket): Promise<void> {
	const s = suite
	if (s) {
		const logger = logEnabled ? console.log : undefined
		const emit = new Emitter()
		const wait: Promise<unknown>[] = [
			new Promise<void>((resolve): void => {
				emit.once('end', resolve)
			})
		]
		const send = (data: IPC.Event): void => {
			wait.push(client.send(data, {
				receptive: false
			}))
		}
		emit.on('done', (file: string): void => {
			const id = s.getFileID(file)
			if (id) {
				send({
					type: 'done',
					file: id
				})
			} else {
				console.error(`Could not find ID of file: ${file}`)
			}
		})
		emit.on('result', (result: TestResult): void => {
			const id = s.getTestID(result.test, result.file)
			if (id) {
				send({
					type: 'result',
					test: id,
					state: result.state
				})
			} else {
				console.error(`Could not find ID of test: ${JSON.stringify(result)}`)
			}
		})
		await s.run(emit, info.run, logger)
		await Promise.all(wait)
	} else {
		console.error('Attemped to run tests when no suite has been loaded.')
	}
}

async function debugTests(_info: IPC.Debug, _client: ServerSocket): Promise<void> { }

declare const connection: Server
connection
	.on('error', (error, client): void => {
		if (client) {
			console.error(`[IPC] Error from ${client.name}:`, error)
		} else {
			console.error(error)
		}
	})
	.on('connect', (client): void => {
		if (client.name === token) {
			if (connected) {
				client.disconnect(true)
				console.error('[Worker] Another connection made.')
			} else if (logEnabled) {
				console.log('[Worker] Connected.')
			}
		} else {
			client.disconnect(true)
			console.error(`[Worker] Connection attempt with: ${client.name}`)
		}
	})
	.on('disconnect', (client): void => {
		if (client.name === token && connected) {
			client.server.close()
		}
	})
	.on('message', (message, client): void => {
		const data = message.data
		if (typeof data === 'object' && data.type && typeof data.type === 'string') {
			const m = data as IPC.Parent
			switch (m.type) {
				case 'log':
					logEnabled = m.enable
					return
				case 'port':
					//debuggerPort = m.port
					return
				case 'load':
					loadTests(m, client).finally((): void => {
						message.reply(null)
					})
					return
				case 'drop':
					return
				case 'run':
					runTests(m, client).finally((): void => {
						message.reply(null)
					})
					return
				case 'stop':
					if (suite) {
						suite.cancel()
					}
					return
				case 'debug':
					debugTests(m, client).finally((): void => {
						message.reply(null)
					})
					return
				default:
					throw new TypeError(`Invalid message type: ${data.type}`)
			}
		} else {
			throw new TypeError('Invalid message.')
		}
	})

async function serve(): Promise<void> {
	const port = await getPort()
	try {
		if (logEnabled) {
			console.log(`[Worker] Will listen on port: ${port}`)
		}
		await connection.listen(port)
		if (process.send) {
			process.send(`${port.toString(16)}:${token}`)
		} else {
			console.error('[Worker] Could not send the token to the parent.')
			connection.close()
		}
	} catch (error) {
		console.error('[Worker] Failed to establish IPC.', error)
		process.exitCode = 1
	}
}

serve()
