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
import stream from 'stream'
import vscode from 'vscode'
import { Log } from 'vscode-test-adapter-util/out/log'
import { LoadedConfig } from './config'

export default abstract class Worker<T> {
	private running?: ChildProcess = undefined
	protected readonly log: Log
	protected readonly channel: vscode.OutputChannel

	protected constructor(l: Log, c: vscode.OutputChannel) {
		this.log = l
		this.channel = c
	}

	public async work(script: string, args: string[], config: LoadedConfig): Promise<void> {
		return new Promise<void>((resolve, reject): void => {
			const child = fork(
				/* eslint node/no-missing-require: "off" */
				require.resolve(script),
				args,
				{
					/* eslint unicorn/prevent-abbreviations: "off" */
					cwd: config.cwd,
					env: config.environment,
					execPath: config.nodePath,
					execArgv: config.nodeArgv,
					stdio: ['pipe', 'pipe', 'pipe', 'ipc']
				}
			)
			this.pipeProcess(child)
			child.on('error', reject)
			child.on('message', (message): void => { this.messageHandler(message) })
			child.on('exit', (code): void => {
				this.exitHandler(code)
				this.running = undefined
				resolve()
			})
		})
	}

	public get alive(): boolean {
		return this.running !== undefined
	}

	protected abstract messageHandler(message: T): void

	protected exitHandler(code: number | null): void {
		this.log.info(`Worker finished with code: ${code}`)
	}

	protected send<M>(message: M): void {
		const target = this.running
		if (target) {
			target.send(message)
		} else {
			this.log.error('Process closed before a message was sent.')
		}
	}

	private pipeProcess(child: ChildProcess): void {
		const customStream = new stream.Writable()
		customStream._write = (data, _encoding, callback): void => {
			try {
				this.channel.append(data.toString())
				callback()
			} catch (error) {
				callback(error)
			}
		}
		if (child.stderr) {
			child.stderr.pipe(customStream)
		}
		if (child.stdout) {
			child.stdout.pipe(customStream)
		}
	}

	public cancel(): void {
		if (this.running) {
			this.running.kill()
		}
	}
}
