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
import arrify from "arrify"
import loadAVAConfig from 'ava/lib/load-config'
import { validate as validateBabel } from 'ava/lib/babel-pipeline'
import normalizeExtensions from 'ava/lib/extensions'
import { normalizeGlobs } from 'ava/lib/globs'
import validateEnvironmentVariables from 'ava/lib/environment-variables'
import AVA from 'ava/namespace'

type Logger = (message: string) => void
type MatchFilter = (match: string[]) => string[]

export interface Setup {
	babelConfig: {};
	cacheEnabled: boolean;
	compileEnhancements: boolean;
	concurrency: number;
	environmentVariables: { [key: string]: string };
	extensions: AVA.Extensions;
	failFast: boolean;
	failWithoutAssertions: boolean;
	globs: AVA.Globs;
	match: string[];
	projectDir: string;
	require: string[];
	resolveTestsFrom: string;
	serial: boolean;
	snapshotDir: string | null;
	timeout?: number;
	updateSnapshots: boolean;
}

export function setup(configFile: string, logger: null | Logger): Setup {
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
	const snapshotDir = avaConfig.snapshotDir ?
		path.resolve(projectDir, avaConfig.snapshotDir) : null
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
		updateSnapshots: avaConfig.updateSnapshots === true
	}
}
