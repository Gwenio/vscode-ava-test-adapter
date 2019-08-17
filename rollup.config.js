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
import jsonfile from 'rollup-plugin-json'
import globby from "globby"

const avaFiles = globby.sync([
	'./node_modules/ava/*.js',
	'./node_modules/ava/lib/*.js',
	'./node_modules/ava/lib/worker/*.js',
	'./node_modules/ava/lib/reporters/*.js',
], { onlyFiles: true, dot: true }).map(file => {
	return file.replace(/^\.\/node_modules\//, '').replace(/\.js$/i, '')
})

function outputBundle(filename, options = {}) {
	return {
		...options,
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
			commonjs({
				sourceMap: false
			}),
			jsonfile({}),
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
			commonjs({
				sourceMap: true
			}),
			jsonfile({}),
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

const avaIntro = {
	intro: "const connection=(function() {\n" +
		"const {Server}=new require('veza/dist/lib/Server');\n" +
		"return new Server('ava-adapter-worker');})()\n" +
		"require=require('module').createRequire(process.cwd()+'/');\n" +
		"require('ava/lib/chalk').set({enabled: false});\n"
}

export default [{
	input: 'tmp/src/main.js',
	external: builtins.concat(
		"vscode",
		"veza",
		"binarytf").concat(avaFiles),
	plugins: configurePlugins(),
	output: outputBundle('dist/main.js')
}, {
	input: 'tmp/src/child.js',
	external: builtins.concat(
		"common-path-prefix",
		"arrify",
		"matcher",
		"get-port",
		"veza",
		"binarytf"
	).concat(avaFiles),
	plugins: configurePlugins(),
	output: outputBundle('dist/child.js', avaIntro)
}]
