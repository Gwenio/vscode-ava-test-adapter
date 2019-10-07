'use strict'

/* eslint node/no-unsupported-features/es-syntax: ["error", { "ignores": ["modules"] }] */

export default {
	require: ['esm', 'module-alias/register'],
	files: ['tmp/test/mock/**'],
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
