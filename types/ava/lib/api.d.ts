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

import AVA from "../namespace"

interface Options {
	babelConfig: AVA.BabalConfig;
	cacheEnabled: boolean;
	color: boolean;
	compileEnhancements: boolean;
	concurrency: number;
	environmentVariables: { [key: string]: string }
	extensions: AVA.Extensions;
	failFast: conf.failFast,
	failWithoutAssertions: boolean;
	globs: AVA.Globs;
	match: string[];
	parallelRuns: null | {
		currentIndex: number;
		totalRuns: number;
	};
	projectDir: string;
	ranFromCli: boolean;
	snapshotDir: string | null;
	timeout: number;
	serial: boolean;
	require: string[];
	resolveTestsFrom: string;
	updateSnapshots: boolean;
	workerArgv: string[];
	testOnlyExecArgv?: string[];
}

declare module 'ava/lib/api' {
	export default class Api {
		constructor(Options);
		run(files: string[] = [], runtimeOptions: AVA.RuntimeOptions = {}): Promise<AVA.Status>;
		on(tag: 'run', handler: (plan: AVA.Plan) => void): void;
		_interruptHandler(): void;
		async _computeForkExecArgv(): Promise<string[]>;
	}
}
