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

import {
	Tree,
	Event
} from '../ipc'
import ConfigInfo from './config_info'

type Logger = (message: string) => void

interface Loaded {
	prefix: string;
	info: {
		file: string;
		tests: string[];
	}[];
}

export default class Suite {
	private readonly configs = new Map<string, ConfigInfo>()

	public cancel(): void {
		for (const c of this.configs.values()) {
			c.cancel()
		}
	}

	public drop(id: string): void {
		const configs = this.configs
		const c = configs.get(id)
		if (c) {
			configs.delete(id)
			c.dispose()
		}
	}

	public async load(file: string, send: (data: Tree) => void, logger?: Logger): Promise<void> {
		const c = new ConfigInfo(file, logger)
		await c.load(logger)
		this.configs.set(c.id, c)
		return c.collectInfo(send, logger)
	}

	public async run(send: (data: Event) => void, plan: string[], logger?: Logger): Promise<void> {
		const wait: Promise<unknown>[] = []
		const v = this.configs.values()
		if (plan.includes('root')) {
			for (const c of v) {
				wait.push(c.run(send, undefined, logger))
			}
		} else {
			for (const c of v) {
				wait.push(c.run(send, plan, logger))
			}
		}
		await Promise.all(wait)
	}

	public async debug(ready: () => void, plan: string[], port: number, serial: boolean,
		logger?: Logger): Promise<void> {
		const v = this.configs.values()
		if (plan.includes('root')) {
			for (const c of v) {
				await c.debug(ready, { port, serial }, logger)
			}
		} else {
			for (const c of v) {
				await c.debug(ready, { plan, port, serial }, logger)
			}
		}
	}
}
