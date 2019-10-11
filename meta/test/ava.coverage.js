'use strict'

/* eslint node/no-unsupported-features/es-syntax: ["error", { "ignores": ["modules"] }] */

import base from './ava.config'

export default {
	...base,
	require: [],
	babel: false,
	compileEnhancements: false,
	cache: false,
}
