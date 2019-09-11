'use strict'

/* eslint node/no-unsupported-features/es-syntax: ["error", { "ignores": ["modules"] }] */

export default {
	require: ['esm'],
	files: ['tmp/test/unit/**', 'tmp/test/worker/**'],
	sources: ['tmp/src/**'],
	babel: {
		testOptions: {
			babelrc: false,
			configFile: false,
		},
	},
	compileEnhancements: true,
	cache: true,
	failFast: false,
}
