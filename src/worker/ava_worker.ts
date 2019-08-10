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

import util from 'util'
import avaApi from 'ava/lib/api'
import AVA from 'ava/namespace'
import { Setup } from './ava_setup'

type Logger = (message: string) => void
type MatchFilter = (match: string[]) => string[]

export interface WorkerOptions {
	reporter: AVA.Reporter;
	logger?: Logger;
	files?: string[];
}

export async function worker(setup: Setup, options: WorkerOptions): Promise<void> {
	const reporter = options.reporter
	const logger = options.logger
	try {
		const api = new avaApi({
			...setup,
			color: false,
			parallelRuns: null,
			ranFromCli: true
		})

		if (logger) logger('Attaching reporter')

		api.on('run', (plan): void => {
			reporter.startRun(plan)
			plan.status.on('stateChange', (event): void => {
				if (event.type === 'interrupt') {
					reporter.endRun()
					/* eslint unicorn/no-process-exit: "off" */
					process.exit(1) // eslint-disable-line no-process-exit
				}
			})
		})

		if (logger) logger('Running AVA')

		const status = await api.run(options.files || [])
		process.exitCode = status.suggestExitCode({ matching: setup.match.length > 0 })
	} catch (error) {
		if (logger) logger(`Caught error ${util.inspect(error)}`)
		process.exitCode = 1
	} finally {
		reporter.endRun()
	}
}
