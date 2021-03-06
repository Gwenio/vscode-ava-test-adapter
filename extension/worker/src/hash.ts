/*
ISC License (ISC)

Copyright 2019 James Adam Armstrong

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above copyright
notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
*/

import hashSum from 'hash-sum'
import random from 'prando'

/** The max random number to use. */
const max = Number.MAX_SAFE_INTEGER

/**
 * Callback type to check if a hash is already in use.
 * @param h The hash to check for.
 */
type Checker = (h: string) => boolean

/**
 * Callback type to modify a generatated hash.
 * @param _ The hash to modify.
 */
type Modify = (_: string) => string

/**
 * Generates a hash for a string.
 * @param text The text generate a hash from.
 * @param has Callback to check if a hash is already in use.
 * @param modify Optional callback to modify the hash value.
 */
export default function hash(text: string, has: Checker, modify?: Modify): string {
	let x = hashSum(text)
	if (modify) {
		let y = modify(x)
		if (has(y)) {
			const prng = new random(x)
			do {
				x = hashSum(prng.nextInt(0, max))
				y = modify(x)
			} while (has(y))
		}
		return y
	} else {
		if (has(x)) {
			const prng = new random(x)
			do {
				x = hashSum(prng.nextInt(0, max))
			} while (has(x))
		}
		return x
	}
}
