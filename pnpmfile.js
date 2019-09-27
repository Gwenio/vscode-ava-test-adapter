'use strict'

module.exports = {
	hooks: {
		readPackage,
	},
}

function readPackage(pack) {
	const aliases = {
		'ow-lite': 'npm:ow@^0.13.2',
	}
	for (const d of [
		'dependencies',
		'devDependencies',
		'peerDependencies',
		'optionalDependencies',
	]) {
		const dependencies = pack[d]
		if (dependencies) {
			for (const [key, value] of Object.entries(aliases)) {
				if (dependencies[key]) {
					dependencies[key] = value
				}
			}
		}
	}
	return pack
}
