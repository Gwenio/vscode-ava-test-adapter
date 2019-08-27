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
import random from 'random'

const generate = random.uniformInt(0, 0xffff)

type Checker = (h: string) => boolean

export default function hash(text: string, has: Checker, prefix?: string, suffix?: string): string {
	let x = hashSum(text)
	let f = (t: string): string => t
	if (prefix) {
		if (suffix) {
			f = (t: string): string => prefix + t + suffix
		} else {
			f = (t: string): string => prefix + t
		}
	} else if (suffix) {
		f = (t: string): string => t + suffix
	}
	let y = f(x)
	while (has(y)) {
		x = hashSum(x + generate().toString(16))
		y = f(x)
	}
	return y
}