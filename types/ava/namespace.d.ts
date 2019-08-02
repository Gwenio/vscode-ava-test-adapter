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

export namespace AVA {
	interface Configuration {
		files?: string[];
		helpers?: string[];
		sources?: string[];
		match?: string[];
		cache?: boolean;
		failFast?: boolean;
		failWithoutAssertions?: boolean;
		environmentVariables?: { [key: string]: string };
		tap?: boolean;
		verbose?: boolean;
		snapshotDir?: string;
		compileEnhancements?: boolean;
		extensions?: string[];
		require?: string[];
		babel?: false | {
			[K in keyof BabelConfig]?: BabelConfig[K]
		};
		timeout?: number;
	}

	interface Parameters {
		configFile?: string;
		resolveFrom: string;
		defaults: Configuration;
	}

	interface Globs {
		extensions: string[];
		testPatterns: string[];
		helperPatterns: string[];
		sourcePatterns: string[];
	}

	interface Extensions {
		all: string[];
		enhancementsOnly: string[];
		full: string[];
	}

	interface BabelConfig {
		extensions?: string[];
		testOptions: {
			babelrc: boolean;
			configFile: boolean;
		};
	}
}
