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

import path from 'path'
import util from 'util'
//import RegExEscape from 'escape-string-regexp'
import arrify from "arrify"
import avaApi from 'ava/lib/api'
import loadAVAConfig from 'ava/lib/load-config'
import { validate as validateBabel } from 'ava/lib/babel-pipeline'
import normalizeExtensions from 'ava/lib/extensions'
import { normalizeGlobs } from 'ava/lib/globs'
import validateEnvironmentVariables from 'ava/lib/environment-variables'
import { AVA } from 'ava/namespace'

type Logger = (message: string) => void

export default async function worker(configFile: string, reporter: AVA.Reporter,
	logger: null | Logger, testsToRun: string[] = []): Promise<void> {
	try {
		if (logger) logger('Loading AVA config file...')
		const avaConfig = loadAVAConfig({ configFile, resolveFrom: process.cwd(), defaults: {} })

		const {
			/* eslint unicorn/prevent-abbreviations: "off" */
			projectDir
		} = avaConfig
		const babelConfig = validateBabel(avaConfig.babel)
		const environmentVariables = validateEnvironmentVariables(avaConfig.environmentVariables)
		const extensions = normalizeExtensions(avaConfig.extensions || [], babelConfig)
		const globs = normalizeGlobs(avaConfig.files, avaConfig.helpers,
			avaConfig.sources, extensions.all)
		const match = arrify(avaConfig.match)
		const resolveTestsFrom = testsToRun.length === 0 ? projectDir : process.cwd()
		const files = testsToRun.map((file): string => {
			return path.relative(resolveTestsFrom, path.resolve(process.cwd(), file))
		})
		const snapshotDir = avaConfig.snapshotDir ?
			path.resolve(projectDir, avaConfig.snapshotDir) : null
		const api = new avaApi({
			babelConfig,
			cacheEnabled: avaConfig.cache !== false,
			color: false,
			compileEnhancements: avaConfig.compileEnhancements !== false,
			concurrency: avaConfig.concurrency ? parseInt(avaConfig.concurrency, 10) : 0,
			extensions,
			failFast: avaConfig.failFast,
			failWithoutAssertions: avaConfig.failWithoutAssertions !== false,
			globs,
			environmentVariables,
			match,
			parallelRuns: null,
			projectDir,
			ranFromCli: false,
			require: arrify(avaConfig.require),
			resolveTestsFrom,
			serial: avaConfig.serial === true,
			snapshotDir,
			timeout: avaConfig.timeout || 30000,
			updateSnapshots: avaConfig.updateSnapshots === true,
			workerArgv: [] // cli.flags['--']
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

		const status = await api.run(files)
		process.exitCode = status.suggestExitCode({ matching: match.length > 0 })
	} catch (error) {
		if (logger) logger(`Caught error ${util.inspect(error)}`)
		process.exitCode = 1
	} finally {
		reporter.endRun()
	}
}
