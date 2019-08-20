"use strict"

/* eslint node/no-unsupported-features/es-syntax: ["error", { "ignores": ["modules"] }] */

import path from 'path'
import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
import {
	terser
} from 'rollup-plugin-terser'
import babel from 'rollup-plugin-babel'
import builtins from 'builtin-modules'
import sourcemaps from 'rollup-plugin-sourcemaps'
import jsonfile from 'rollup-plugin-json'
import license from 'rollup-plugin-license'
import globby from "globby"
import chalk from 'chalk'

function bundleSize() {
	return {
		name: 'bundle-size',
		generateBundle(options, bundle) {
			/** @type string */
			const a = path.basename(options.file)
			/** @type string */
			const c = bundle[a].code
			console.log(`Size of ${chalk.cyan(a)}: ${c.length.toString()}`)
		}
	}
}

function dependList() {
	return {
		name: 'depend-list',
		generateBundle(options, bundle) {
			const f = path.basename(options.file)
			const s = new Set()
			Object.keys(bundle[f].modules)
				.filter(x => !x.startsWith('\u0000'))
				.map(x => path.dirname(x).split(path.sep))
				.filter(x => x.includes('node_modules'))
				.map(x => x.slice(x.lastIndexOf('node_modules') + 1))
				.map(x => x.slice(0, x[0].startsWith('@') ? 2 : 1))
				.map(x => x.join(path.sep))
				.forEach(x => s.add(x))
			console.log([...s])
		}
	}
}

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
				sourcemap: false,
				plugins: [
					["transform-inline-environment-variables",
						{
							"include": ["NODE_ENV"]
						}
					],
					"transform-remove-undefined",
					"transform-inline-consecutive-adds",
					"transform-property-literals",
					"transform-regexp-constructors",
					"minify-guarded-expressions",
				],
				configFile: false,
				babelrc: false
			}),
			license({
				sourcemap: false,
				banner: {
					commentStyle: 'ignored',
					content: {
						file: path.join(__dirname, 'LICENSE'),
						encoding: 'utf-8',
					}
				}
			}),
			terser({
				sourcemap: false,
				ecma: 8,
				parse: {
					shebang: true
				},
				output: {
					comments: /^!/,
					shebang: true
				}
			}),
			dependList(),
			bundleSize()
		]
	} else {
		return [
			sourcemaps(),
			resolve({}),
			commonjs({
				sourceMap: true
			}),
			jsonfile({
				sourcemap: true
			}),
			babel({
				sourcemap: true,
				plugins: [
					["transform-inline-environment-variables",
						typeof process.env.NODE_ENV === 'string' ?
							{ "include": ["NODE_ENV"] } : {}
					],
					"transform-remove-undefined",
					"transform-member-expression-literals",
					"transform-inline-consecutive-adds",
					"transform-property-literals",
					"transform-regexp-constructors",
					"minify-constant-folding",
					"minify-guarded-expressions",
					["minify-dead-code-elimination",
						{
							keepFnName: true,
							/* eslint unicorn/prevent-abbreviations: "off" */
							keepFnArgs: true,
							keepClassName: true,
							tdz: true
						}]
				],
				configFile: false,
				babelrc: false
			}),
			bundleSize()
		]
	}
}

const avaIntro = {
	intro: "const connection=(function() {\n" +
		"const {Server}=new require('veza/dist/lib/Server')\n" +
		"return new Server('ava-adapter-worker')})()\n" +
		"require=require('module').createRequire(process.cwd()+'/')\n" +
		"require('ava/lib/chalk').set({enabled: false})\n"
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
