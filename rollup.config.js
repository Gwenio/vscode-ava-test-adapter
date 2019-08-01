"use strict"

/* eslint node/no-unsupported-features/es-syntax: ["error", { "ignores": ["modules"] }] */

import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
import {
	terser
} from 'rollup-plugin-terser'
import babel from 'rollup-plugin-babel'
import builtins from 'builtin-modules'
import sourcemaps from 'rollup-plugin-sourcemaps'

const avaFiles = ["ava",
	"ava/lib",
	"ava/lib/api",
	"ava/lib/load-config",
	"ava/lib/reporters/verbose",
	"ava/lib/reporters/mini",
	"ava/lib/reporters/tap",
	"ava/lib/babel-pipeline",
	"ava/lib/extensions",
	"ava/lib/globs",
	"ava/lib/environment-variables"
]

function outputBundle(filename) {
	return {
		file: filename,
		format: 'cjs',
		sourcemap: process.env.NODE_ENV !== 'production',
		sourcemapFile: `${filename}.map`,
		preferConst: true
	}
}

function configurePlugins() {
	if (process.env.NODE_ENV === 'production') {
		return [
			resolve({}),
			commonjs({}),
			babel({
				plugins: [
					["transform-inline-environment-variables",
						{
							"include": ["NODE_ENV"]
						}
					],
					"transform-remove-undefined",
					"transform-remove-debugger",
					"transform-member-expression-literals",
					"transform-inline-consecutive-adds",
					"transform-property-literals",
					"transform-regexp-constructors",
					"minify-constant-folding",
					"minify-guarded-expressions",
					["minify-dead-code-elimination",
						{
							keepClassName: true
						}
					],
					["minify-mangle-names",
						{
							keepClassName: true
						}
					]
				],
				configFile: false,
				babelrc: false
			}),
			terser({
				ecma: 8,
				parse: {
					shebang: true
				}
			})
		]
	} else {
		return [
			sourcemaps(),
			resolve({}),
			commonjs({}),
			babel({
				plugins: [
					"transform-remove-undefined",
					"transform-member-expression-literals",
					"transform-inline-consecutive-adds",
					"transform-property-literals",
					"transform-regexp-constructors",
					"minify-constant-folding",
					"minify-guarded-expressions"
				],
				configFile: false,
				babelrc: false
			})
		]
	}
}

export default [{
	input: 'tmp/src/main.js',
	external: builtins.concat(
		"vscode",
		"child_process",
		"json5",
		"minimatch",
		"vscode-test-adapter-util",
		"vscode-test-adapter-api"),
	plugins: configurePlugins(),
	output: outputBundle('dist/main.js')
}, {
	input: 'tmp/src/worker/run_tests.js',
	external: builtins.concat(
		"vscode",
		"arrify").concat(avaFiles),
	plugins: configurePlugins(),
	output: outputBundle('dist/worker/run_tests.js')
}, {
	input: 'tmp/src/worker/load_tests.js',
	external: builtins.concat(
		"vscode",
		"vscode-test-adapter-api",
		"globby"
	).concat(avaFiles),
	plugins: configurePlugins(),
	output: outputBundle('dist/worker/load_tests.js')
}]
