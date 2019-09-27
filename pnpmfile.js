'use strict'

module.exports = {
	hooks: {
		readPackage,
	},
}

const remap = new Set(['random'])

function readPackage(pack) {
	if (remap.has(pack.name)) {
		const types = [
			'dependencies',
			'devDependencies',
			'peerDependencies',
			'optionalDependencies',
		]
		const aliases = {
			'ow-lite': 'npm:ow@^0.13.2',
		}
		for (const d of types) {
			const dependencies = pack[d]
			if (dependencies) {
				for (const [key, value] of Object.entries(aliases)) {
					if (dependencies[key]) {
						dependencies[key] = value
					}
				}
			}
		}
	}
	return pack
}
