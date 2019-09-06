'use strict'

/* eslint node/no-unsupported-features/es-syntax: ["error", { "ignores": ["modules"] }] */

export default {
	require: ['esm'],
	files: ['tmp/test/worker/*.js'],
	sources: ['tmp/src/*.js', 'tmp/src/reporter/*.js', 'tmp/src/worker/*.js'],
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
