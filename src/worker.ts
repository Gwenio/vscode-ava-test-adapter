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
import vscode from 'vscode'
import { Log } from 'vscode-test-adapter-util/out/log'
import { Parent, Child } from './ipc'

const script = './child'

interface WorkerConfig {
	cwd: string;
	environment: NodeJS.ProcessEnv;
	nodePath: string | undefined;
	nodeArgv: string[];
}

interface Prefix {
	id: string;
	file: string;
	prefix: string;
}

interface File {
	id: string;
	file: string;
	config: string;
}

interface Test {
	id: string;
	file: string;
	test: string;
}

interface Result {
	test: string;
	state: 'running' | 'passed' | 'failed' | 'skipped' | 'errored';
}

type Basic = 'error' | 'exit' | 'message' | 'disconnect'
type Output = 'stdout' | 'stderr'
type Events = Basic | Output | 'prefix' | 'file' | 'case' | 'result' | 'done' | 'end'

export default class Worker {
	private child?: ChildProcess
	protected readonly log: Log
	protected readonly channel: vscode.OutputChannel
	private readonly emitter: Emitter = new Emitter()

	public constructor(l: Log, c: vscode.OutputChannel) {
		this.log = l
		this.channel = c
	}

	public start(config: WorkerConfig): void {
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
				message?: string | Prefix | File | Test | Result | Error) => void =
				this.emitter.emit.bind(this.emitter)
			if (typeof message === 'string') {
				emit('message', message)
			} else {
				switch (message.type) {
					case 'prefix':
						emit('prefix', {
							id: message.id,
							prefix: message.prefix,
							file: message.file
						})
						return
					case 'file':
						emit('file', {
							id: message.id,
							config: message.config,
							file: message.file
						})
						return
					case 'case':
						emit('case', {
							id: message.id,
							test: message.test,
							file: message.file
						})
						return
					case 'result':
						emit('result', {
							test: message.test,
							state: message.state
						})
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
	public on(event: 'file', handler: (file: File) => void): Worker
	public on(event: 'case', handler: (test: Test) => void): Worker
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
	public once(event: 'file', handler: (file: File) => void): Worker
	public once(event: 'case', handler: (test: Test) => void): Worker
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
			this.log.error('Process closed before a message was sent.')
		}
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
