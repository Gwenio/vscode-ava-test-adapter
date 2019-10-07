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

import avaApi from 'ava/lib/api'
// eslint-disable-next-line node/no-missing-import
import AVA from 'ava/namespace'
import { Setup } from './ava_setup'
import { ErrorReporter } from './reporter'

/** Logger callback type. */
type Logger = (message: string) => void

/** Options for creating the worker. */
export interface WorkerOptions {
	/** The Reporter to send events to. */
	reporter: AVA.Reporter
	/** Optional logging callback. */
	logger?: Logger
	/** Optional list of test files to run. */
	files?: string[]
	/** Optional inspect port number. */
	port?: number
	/** Optional callback to send an function for interrupting the run. */
	interrupt?: (cb: () => void) => void
}

/**
 * Executes a test run.
 * @param setup The setup configuration for the worker.
 * @param options Additional options for the worker.
 * @returns A Promise of the run's Status.
 */
export async function worker(setup: Setup, options: WorkerOptions): Promise<void> {
	const reporter = new ErrorReporter(options.reporter)
	const logger = options.logger
	const api = new avaApi({
		...setup,
		color: false,
		parallelRuns: null,
		ranFromCli: false,
	})

	if (options.port) {
		const original = api._computeForkExecArgv.bind(api)
		api._computeForkExecArgv = async function(): Promise<string[]> {
			const base = await original()
			const filtered = base.filter((a): boolean => !a.startsWith('--inspect'))
			return filtered.concat(`--inspect-brk=${options.port}`)
		}
	} else {
		const original = api._computeForkExecArgv.bind(api)
		api._computeForkExecArgv = async function(): Promise<string[]> {
			const base = await original()
			return base.filter((a): boolean => !a.startsWith('--inspect'))
		}
	}

	api.on('run', (plan): void => {
		reporter.startRun(plan)
		if (options.interrupt) {
			options.interrupt(api._interruptHandler.bind(api))
		}
	})

	if (logger) logger('Running AVA')

	try {
		await api.run(options.files || [])
	} finally {
		reporter.endRun()
	}
}
