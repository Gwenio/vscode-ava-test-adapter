'use strict'

/* eslint node/no-unsupported-features/es-syntax: ["error", { "ignores": ["modules"] }] */
/* eslint node/no-unpublished-import: "off" */

import path from 'path'
import fs from 'fs'
import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import babel from 'rollup-plugin-babel'
import builtins from 'builtin-modules'
import sourcemaps from 'rollup-plugin-sourcemaps'
import jsonfile from 'rollup-plugin-json'
import alias from 'rollup-plugin-alias'
import globby from 'globby'
// eslint-disable-next-line node/no-extraneous-import
import chalk from 'chalk'
import is from '@sindresorhus/is'

function bundleSize() {
	return {
		name: 'bundle-size',
		generateBundle(options, bundle) {
			/** @type string */
			const a = path.basename(options.file)
			/** @type string */
			const c = bundle[a].code
			console.log(`Size of ${chalk.cyan(a)}: ${chalk.green(c.length.toString())}`)
		},
	}
}

function normalizeSources() {
	return {
		name: 'normalize-sources',
		generateBundle(options, bundle) {
			const f = path.basename(options.file)
			const m = bundle[f].map
			if (m) {
				const { sources } = m
				const normal = []
				const n = '/node_modules/'
				for (const x of sources) {
					if (x.includes(n)) {
						const y = x.split(':')
						const z = y[0]
						const i = z.lastIndexOf(n)
						y[0] = '.' + z.slice(i)
						normal.push(y.join(':'))
					} else normal.push(x)
				}
				m.sources = normal
			}
		},
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
		},
	}
}

const avaFiles = globby
	.sync(
		[
			'./node_modules/ava/*.js',
			'./node_modules/ava/lib/*.js',
			'./node_modules/ava/lib/worker/*.js',
			'./node_modules/ava/lib/reporters/*.js',
		],
		{ onlyFiles: true, dot: true }
	)
	.map(file => {
		return file.replace(/^\.\/node_modules\//, '').replace(/\.js$/i, '')
	})

function outputBundle(filename, options = {}) {
	return {
		...options,
		file: filename,
		format: 'cjs',
		sourcemap: true,
		sourcemapFile: `${filename}.map`,
		preferConst: true,
	}
}

const eol = /(\r?)\n/g

function formatLicense() {
	const raw = fs.readFileSync('extension/LICENSE')
	if (is.string(raw)) return `/*\n${raw}*/`.replace(eol, '\r\n')
	else if (is.buffer(raw)) return `/*\n${raw.toString()}*/`.replace(eol, '\r\n')
	else throw new TypeError('Expected fs.readFileSync to return a string or buffer.')
}

const aliases = {
	entries: [
		{
			find: /^~ipc\/(.*)$/i,
			replacement: 'node_modules/~ipc/lib/$1.js',
		},
	],
}

function configurePlugins() {
	if (process.env.NODE_ENV === 'production') {
		return [
			sourcemaps(),
			alias(aliases),
			resolve({}),
			commonjs({
				sourcemap: true,
			}),
			jsonfile({}),
			babel({
				sourcemap: true,
				plugins: [
					[
						'transform-inline-environment-variables',
						{
							include: ['NODE_ENV'],
						},
					],
					'transform-remove-undefined',
					'transform-inline-consecutive-adds',
					'transform-property-literals',
					'transform-regexp-constructors',
					'minify-guarded-expressions',
					[
						'minify-dead-code-elimination',
						{
							keepFnName: true,
							/* eslint unicorn/prevent-abbreviations: "off" */
							keepFnArgs: true,
							keepClassName: true,
							tdz: true,
						},
					],
				],
				configFile: false,
				babelrc: false,
			}),
			terser({
				sourcemap: true,
				toplevel: true,
				ecma: 8,
				parse: {
					shebang: true,
				},
				output: {
					comments: false,
					shebang: true,
					preamble: formatLicense(),
				},
			}),
			dependList(),
			bundleSize(),
			normalizeSources(),
		]
	} else {
		return [
			sourcemaps(),
			alias(aliases),
			resolve({}),
			commonjs({
				sourceMap: true,
			}),
			jsonfile({
				sourcemap: true,
			}),
			babel({
				sourcemap: true,
				plugins: [
					[
						'transform-inline-environment-variables',
						is.nonEmptyString(process.env.NODE_ENV)
							? { include: ['NODE_ENV'] }
							: { include: [] },
					],
					'transform-inline-consecutive-adds',
					[
						'minify-dead-code-elimination',
						{
							keepFnName: true,
							/* eslint unicorn/prevent-abbreviations: "off" */
							keepFnArgs: true,
							keepClassName: true,
							tdz: true,
						},
					],
				],
				configFile: false,
				babelrc: false,
			}),
			terser({
				sourcemap: true,
				ecma: 8,
				keep_classnames: true,
				//keep_fnames: true,
				warnings: true,
				toplevel: true,
				parse: {
					shebang: true,
				},
				compress: {
					/* eslint unicorn/prevent-abbreviations: "off" */
					defaults: false,
					arrows: true,
					evaluate: true,
					properties: true,
					computed_props: true,
					dead_code: true,
				},
				output: {
					comments: 'some',
					shebang: true,
					beautify: true,
					semicolons: false,
					keep_quoted_props: true,
					indent_level: 2,
					max_line_len: 100,
				},
			}),
			bundleSize(),
		]
	}
}

const avaIntro = {
	intro:
		'const connection=(function() {\n' +
		"const {Server}=new require('veza/dist/lib/Server')\n" +
		"return new Server('ava-adapter-worker')})()\n" +
		'require=((m) => {\n' +
		"if (m.createRequire) return m.createRequire(process.cwd()+'/')\n" +
		"else return require('import-from').bind(null, process.cwd()+'/')\n" +
		"})(require('module'))\n" +
		"require('ava/lib/chalk').set({enabled: false})\n",
}

export default [
	{
		input: 'node_modules/~adapter/tmp/main.js',
		external: builtins.concat('vscode', 'veza', 'binarytf').concat(avaFiles),
		plugins: configurePlugins(),
		output: outputBundle('extension/main.js'),
	},
	{
		input: 'node_modules/~worker/tmp/child.js',
		external: builtins
			.concat('arrify', 'matcher', 'get-port', 'veza', 'binarytf')
			.concat(avaFiles),
		plugins: configurePlugins(),
		output: outputBundle('extension/child.js', avaIntro),
	},
]
