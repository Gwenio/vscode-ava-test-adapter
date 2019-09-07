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

import test from 'ava'
import hash from '../../../src/worker/hash'

test('creates a hash', async (t): Promise<void> => {
	const f = (_: string): boolean => false
	const m = new Map<string, string>()
	for (const x of ['a', 'ab', 'abc']) {
		m.set(x, hash(x, f))
	}
	const l = hash('abcd', f).length
	const r = /[a-f0-9]*/
	for (const [x, y] of m) {
		t.is(typeof y, 'string')
		t.not(x, y)
		t.is(y.length, l)
		t.true(r.test(y))
	}
})

test('initial hash is deterministic', async (t): Promise<void> => {
	const f = (_: string): boolean => false
	const m = new Map<string, string>()
	for (const x of ['a', 'ab', 'abc']) {
		m.set(x, hash(x, f))
	}
	for (const [x, y] of m) {
		t.is(hash(x, f), y)
	}
})

test('prevents repeats', async (t): Promise<void> => {
	const l: string[] = []
	const has = l.includes.bind(l)
	for (let x = 0; x < 5; x++) {
		l.push(hash('abc', has))
	}
	const s = new Set<string>()
	for (const x of l) {
		s.add(x)
	}
	t.is(l.length, s.size)
})

test('prefix & suffix', async (t): Promise<void> => {
	const f = (_: string): boolean => false
	const h0 = hash('abc', f)
	const h1 = hash('abc', f, 'A')
	const h2 = hash('abc', f, undefined, 'Z')
	const h3 = hash('abc', f, 'A', 'Z')
	t.is(h1, 'A' + h0)
	t.is(h2, h0 + 'Z')
	t.is(h3, 'A' + h0 + 'Z')
	const has = (x: string): boolean => x === h0
	const h4 = hash('abc', has, 'A')
	const h5 = hash('abc', has, undefined, 'Z')
	const h6 = hash('abc', has, 'A', 'Z')
	t.is(h1, h4)
	t.is(h2, h5)
	t.is(h3, h6)
})
