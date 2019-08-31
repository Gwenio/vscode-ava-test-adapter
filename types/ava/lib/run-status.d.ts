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

/* eslint-disable */ // VSCode ESLint plugin does not respect .eslintignore

import AVA from '../namespace'
import { emit } from 'cluster'

declare module 'ava/lib/run-status' {
	export default class Status implements AVA.Status {
		constructor(files: string[], parallelRuns: null | number)
		on(tag: 'stateChange', handler: (event: AVA.Event) => void): () => void
		once(tag: 'stateChange', handler: (event: AVA.Event) => void): Promise<void>
		emit(tag: 'stateChange', event: AVA.Event): Promise<void>
		emitSerial(tag: 'stateChange', event: AVA.Event): void
		suggestExitCode(circumstances: { matching: boolean }): number
		emitStateChange(event: AVA.Event): void
	}
}
