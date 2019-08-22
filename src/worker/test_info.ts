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

import hash from '../hash'
import FileInfo from './file_info'

/**
 * @summary Stores information on a test case.
 */
export default class TestInfo {
	/**
	 * @summary The ID of the test case.
	 */
	public readonly id: string

	/**
	 * @summary The name of the test case.
	 */
	public readonly name: string

	/**
	 * @summary The test file of the test case.
	 */
	private readonly file: FileInfo

	/**
	 * @summary Set of active test IDs.
	 */
	private static readonly testSet = new Set<string>()

	/**
	 * @summary Used to check if an ID is in use.
	 */
	private static readonly idExists = TestInfo.testSet.has.bind(TestInfo.testSet)

	public readonly dispose: () => void

	public constructor(name: string, file: FileInfo) {
		this.name = name
		this.file = file
		const i = hash(name, TestInfo.idExists, 't', name.length.toString(16))
		this.id = i
		const s = TestInfo.testSet
		s.add(i)
		this.dispose = s.delete.bind(s, i)
	}

	public get fileName(): string {
		return this.file.name
	}
}
