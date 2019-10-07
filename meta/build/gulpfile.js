'use strict'

const stream = require('stream')
const path = require('path')
const { src, dest } = require('gulp')
const plumber = require('gulp-plumber')

const source = path.resolve(process.cwd(), 'node_modules/~deps/tmp')

exports.prepare = function(callback) {
	return stream.pipeline(
		src(`${source}/**`, {
			base: path.relative(process.cwd(), source),
			resolveSymlinks: true,
		}),
		plumber(),
		dest('extension/node_modules'),
		callback
	)
}
