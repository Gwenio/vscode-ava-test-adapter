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

/* eslint-disable */ // VSCode ESLint plugin does not respect .eslintignore

import { Event } from './events'

export interface BabelConfig {
	extensions?: string[]
	testOptions: {
		babelrc: boolean
		configFile: boolean
	}
}

export interface Configuration {
	files?: string[]
	helpers?: string[]
	sources?: string[]
	match?: string[]
	color?: boolean
	cache?: boolean
	concurrency?: string
	failFast?: boolean
	failWithoutAssertions?: boolean
	environmentVariables?: { [key: string]: string }
	tap?: boolean
	verbose?: boolean
	serial?: boolean
	snapshotDir?: string
	updateSnapshots?: boolean
	compileEnhancements?: boolean
	extensions?: string[]
	require?: string[]
	babel?:
		| false
		| {
				[K in keyof BabelConfig]?: BabelConfig[K]
		  }
	timeout?: number
	watch?: boolean
}

export interface Parameters {
	configFile?: string
	resolveFrom: string
	defaults: Configuration
}

export interface Globs {
	extensions: string[]
	testPatterns: string[]
	helperPatterns: string[]
	sourcePatterns: string[]
}

export interface Extensions {
	all: string[]
	enhancementsOnly: string[]
	full: string[]
}

export interface Status {
	on(tag: string, handler: (event: Event) => void): () => void
	suggestExitCode(circumstances: { matching: boolean }): number
	emitStateChange(event: Event): void
}

export interface RuntimeOptions {
	clearLogOnNextRun?: boolean
	previousFailures?: number
	runOnlyExclusive?: boolean
	runVector?: number
	updateSnapshots?: boolean
}

export interface Plan {
	clearLogOnNextRun: boolean
	failFastEnabled: boolean
	filePathPrefix: string
	files: string[]
	matching: boolean
	previousFailures: number
	runOnlyExclusive: boolean
	runVector: number
	status: Status
}

export interface Reporter {
	startRun(plan: AVA.Plan): void
	endRun(): void
}
