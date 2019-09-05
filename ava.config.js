'use strict'

/* eslint node/no-unsupported-features/es-syntax: ["error", { "ignores": ["modules"] }] */

export default {
	require: [
		//"ts-node/register/transpile-only",
		//"tsconfig-paths/register",
		//"@babel/register",
		'esm',
	],
	files: ['tmp/test/unit/reporter/*.js', 'tmp/test/unit/adapter/*.js', 'tmp/test/worker/*.js'],
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
