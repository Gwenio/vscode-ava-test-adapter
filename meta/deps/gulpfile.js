'use strict'

const stream = require('stream')
const path = require('path')
// eslint-disable-next-line node/no-unsupported-features/node-builtins
const { promises: fs } = require('fs')
const { src, dest } = require('gulp')
const plumber = require('gulp-plumber')
const babel = require('gulp-babel')
const terser = require('gulp-terser')
const filter = require('gulp-filter')
const sourcemap = require('gulp-sourcemaps')
const globby = require('globby')
const json = require('json5')
const is = require('@sindresorhus/is')
const through = require('through2')
const buffer = require('vinyl-buffer')

const source = path.resolve(process.cwd(), 'node_modules')

const dependencies = fs
	.readFile('package.json')
	.then(raw => {
		return json.parse(raw.toString())
	})
	.then(data => {
		if (is.plainObject(data.dependencies)) {
			return Object.keys(data.dependencies)
		} else {
			throw new TypeError('Expected dependencies to be an object.')
		}
	})

const exclude = globby(['md', 'd.ts', 'js.map'].map(x => `*/**/*.${x}`), {
	cwd: source,
}).then(x => new Set(x.map(y => y.replace(/\//g, path.sep))))

const terserOptions = {
	toplevel: true,
	ecma: 8,
	parse: {
		shebang: true,
	},
	output: {
		shebang: true,
	},
}

const babelOptions = {
	plugins: [
		'@babel/plugin-syntax-bigint',
		[
			'minify-replace',
			{
				replacements: [
					{
						identifierName: 'process.env',
						member: 'NODE_ENV',
						replacement: {
							type: 'stringLiteral',
							value: 'production',
						},
					},
				],
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
}

exports.prepare = async function() {
	const d = (await dependencies).join(',')
	const ignore = await exclude
	const js = filter('**/*.js', { restore: true })
	return new Promise((resolve, reject) =>
		stream.pipeline(
			src(`${source}/{${d}}/**`, {
				base: path.relative(process.cwd(), source),
				buffer: false,
				resolveSymlinks: true,
			}),
			plumber(),
			through.obj(function(file, encoding, callback) {
				if (file.contents && !ignore.has(file.relative)) {
					this.push(file, encoding)
				}
				callback()
			}),
			buffer(),
			js,
			sourcemap.init({ loadMaps: true }),
			babel(babelOptions),
			terser(terserOptions),
			sourcemap.write('.'),
			js.restore,
			dest(`tmp`),
			error => {
				if (error) reject(error)
				else resolve()
			}
		)
	)
}

exports.listdeps = async function() {
	const ignore = await exclude
	const prefix = source.length + 2
	for (const name of await dependencies) {
		console.group(`${name}:`)
		for await (const file of globby.stream(`${source}/${name}/**`, {
			cwd: path.join(source),
		})) {
			const f = file.replace(/\//g, path.sep)
			if (!ignore.has(f)) {
				console.log(f.slice(prefix + name.length))
			}
		}
		console.groupEnd()
	}
}

exports.listx = async function() {
	const ignore = await exclude
	for (const x of ignore.values()) {
		console.log(x)
	}
}
