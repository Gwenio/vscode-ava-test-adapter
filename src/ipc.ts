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

export interface AVATestPrefix {
	type: 'prefix';
	prefix: string;
}

export interface AVATestFile {
	type: 'file';
	id: string;
}

export interface AVATestCase {
	type: 'case';
	id: string;
	file: string;
}

export type AVATestMeta = AVATestPrefix | AVATestFile | AVATestCase

export interface AVAEvent {
	type: 'event';
	test: string;
	state: 'running' | 'passed' | 'failed' | 'skipped' | 'errored';
	file: string;
}

export interface AVADone {
	type: 'done';
	file: string;
}
