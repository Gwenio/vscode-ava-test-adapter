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

import { Tree, Event } from '~ipc/messages'
import ConfigInfo from './config_info'
import Session from './session'

/** Logger callback type. */
type Logger = (message: string) => void

/** Manages test configurations. */
export default class Suite {
	/** Map of IDs to the associated ConfigInfo. */
	private readonly configs = new Map<string, ConfigInfo>()

	/** The active test sessions. */
	private readonly sessions = new Map<number, Session>()

	/** Cancels active test runs. */
	public cancel(): void {
		for (const s of this.sessions.values()) {
			s.stop()
		}
		this.sessions.clear()
	}

	/**
	 * Drops configurations.
	 * @param id The ID of the configuration to drop or undefined to drop all.
	 */
	public drop(id?: string): void {
		this.cancel()
		const configs = this.configs
		if (id) {
			const c = configs.get(id)
			if (c) {
				configs.delete(id)
				c.dispose()
			}
		} else {
			for (const c of configs.values()) {
				c.dispose()
			}
			configs.clear()
		}
	}

	/**
	 * Loads a test configuration.
	 * @param file The file name of the configuration to load.
	 * @param send Callback to send loaded information.
	 * @param logger Optional logger callback.
	 */
	public async load(file: string, send: (data: Tree) => void, logger?: Logger): Promise<void> {
		const c = new ConfigInfo(file, logger)
		await c.load(logger)
		this.configs.set(c.id, c)
		return c.collectInfo(send, logger)
	}

	/**
	 * Runs tests.
	 * @param send Callback to send test results.
	 * @param id The test run session id.
	 * @param plan IDs to include in the test run.
	 * @param logger Optional logger callback.
	 */
	public async run(
		send: (data: Event) => void,
		id: number,
		plan: string[],
		logger?: Logger
	): Promise<void> {
		const wait: Promise<unknown>[] = []
		const session = new Session(send)
		this.sessions.set(id, session)
		const v = this.configs.values()
		if (plan.includes('root')) {
			for (const c of v) {
				wait.push(c.run(session, undefined, logger))
			}
		} else {
			for (const c of v) {
				wait.push(c.run(session, plan, logger))
			}
		}
		await Promise.all(wait)
		this.sessions.delete(id)
	}

	/**
	 *
	 * @param ready Callback to singal debug session is ready.
	 * @param plan IDs to include in the test run.
	 * @param port The preferred the inspect port.
	 * @param serial Information about which configurations to run serially.
	 * @param logger Optional logger callback.
	 */
	public async debug(
		ready: (config: string, port: number) => void,
		plan: string[],
		port: number,
		serial: { x: boolean; list: string[] },
		logger?: Logger
	): Promise<void> {
		const v = this.configs.values()
		const { x, list } = serial
		const s = list.includes.bind(list)
		if (plan.includes('root')) {
			for (const c of v) {
				await c.debug(ready.bind(null, c.id), { port, serial: x !== s(c.id) }, logger)
			}
		} else {
			for (const c of v) {
				await c.debug(
					ready.bind(null, c.id),
					{ plan, port, serial: x !== s(c.id) || false },
					logger
				)
			}
		}
	}
}
