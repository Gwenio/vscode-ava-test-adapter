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
import arrify from 'arrify'
import loadAVAConfig from 'ava/lib/load-config'
import { validate as validateBabel } from 'ava/lib/babel-pipeline'
import normalizeExtensions from 'ava/lib/extensions'
import { normalizeGlobs } from 'ava/lib/globs'
import validateEnvironmentVariables from 'ava/lib/environment-variables'
// eslint-disable-next-line node/no-missing-import
import AVA from 'ava/namespace'

/** Logger callback type. */
type Logger = (message: string) => void

/** The configuration for an AVA worker. */
export interface Setup {
	/** The babelConfig for the worker. */
	babelConfig: AVA.BabelConfig
	/** Sets if caching is enabled. */
	cacheEnabled: boolean
	/** Sets if compiling enhancements is enabled. */
	compileEnhancements: boolean
	/** The concurrency for the worker. */
	concurrency: number
	/** The environment variables for the worker. */
	environmentVariables: { [key: string]: string }
	/** The allowed test file extensions. */
	extensions: AVA.Extensions
	/** Sets whether test runs quit on first failure. */
	failFast: boolean
	/** Sets whether a test fails if no assertions are made. */
	failWithoutAssertions: boolean
	/** File globs. */
	globs: AVA.Globs
	/** Array of matcher experssions to filter test titles with. */
	match: string[]
	/** The directory containing the configuration file. */
	projectDir: string
	/** Array of modules to preload for tests. */
	require: string[]
	/** The directory test files are resolved relative to. */
	resolveTestsFrom: string
	/** Sets whether tests are forced to run serially. */
	serial: boolean
	/** Optional directory to store snapshots in. */
	snapshotDir: string | null
	/** Optional number of milliseconds of no activity after which a run fails. */
	timeout?: number
	/** Sets whether to update snapshots. */
	updateSnapshots: boolean
	/** CLI arguments to append when forking test workers. */
	workerArgv: string[]
}

/**
 * Sets up for creating AVA workers.
 * @param configFile The configuration file to load.
 * @param logger The logging callback.
 */
export function setup(configFile: string, logger?: Logger): Setup {
	if (logger) logger('Loading AVA config file...')
	const avaConfig = loadAVAConfig({ configFile, resolveFrom: process.cwd(), defaults: {} })

	const {
		/* eslint unicorn/prevent-abbreviations: "off" */
		projectDir,
	} = avaConfig
	const babelConfig = validateBabel(avaConfig.babel)
	const environmentVariables = validateEnvironmentVariables(avaConfig.environmentVariables)
	const extensions = normalizeExtensions(avaConfig.extensions || [], babelConfig)
	const globs = normalizeGlobs(
		avaConfig.files,
		avaConfig.helpers,
		avaConfig.sources,
		extensions.all
	)
	const match = arrify(avaConfig.match)
	const snapshotDir = avaConfig.snapshotDir
		? path.resolve(projectDir, avaConfig.snapshotDir)
		: null
	if (logger) logger('Config loaded.')
	return {
		babelConfig,
		cacheEnabled: avaConfig.cache !== false,
		compileEnhancements: avaConfig.compileEnhancements !== false,
		concurrency: avaConfig.concurrency ? parseInt(avaConfig.concurrency, 10) : 0,
		extensions,
		failFast: avaConfig.failFast === true,
		failWithoutAssertions: avaConfig.failWithoutAssertions !== false,
		globs,
		environmentVariables,
		match,
		projectDir,
		require: arrify(avaConfig.require),
		resolveTestsFrom: projectDir,
		serial: avaConfig.serial === true,
		snapshotDir,
		timeout: avaConfig.timeout,
		updateSnapshots: avaConfig.updateSnapshots === true,
		workerArgv: [], // cli.flags['--']
	}
}
