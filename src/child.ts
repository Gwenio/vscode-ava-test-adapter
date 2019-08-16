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

import AVA from 'ava/namespace'
import Api from 'ava/lib/api'
import { setup } from './worker/ava_setup'
import { worker } from './worker/ava_worker'
import { LoadReporter } from './reporter'
import * as IPC from './ipc'

let logEnabled = false
let debuggerPort = 9229

Api.prototype._computeForkExecArgv = async function (): Promise<string[]> {
	return process.execArgv.concat(`--inspect-brk=${debuggerPort}`)
}

function send(message: string | IPC.Child): void {
	if (process.send) {
		process.send(message)
	} else if (process.env.NODE_ENV === 'production') {
		throw new TypeError('process.send unavailable')
	} else {
		console.log(message)
	}
}

function handler(error: Error): void {
	console.error(error.stack)
	if (!process.exitCode || process.exitCode === 0) {
		process.exitCode = 1
	}
}

process.on('message', (message: IPC.Parent): void => {
	switch (message.type) {
		case 'log':
			logEnabled = message.enable
			return
		case 'port':
			debuggerPort = message.port
			return
		case 'load':
			return
		case 'drop':
			return
		case 'run':
			return
		case 'stop':
			return
		case 'debug':
			return
		default:
			throw new TypeError('Invalid message.')
	}
})
