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

import AVA from 'ava/namespace'
import { setup, Setup } from './ava_setup'
import { worker } from './ava_worker'
import { LoadReporter } from '../reporter'
import hash from '../hash'
import {
	Tree
} from '../ipc'

type Logger = (message: string) => void

interface Loaded {
	prefix: string;
	info: {
		file: string;
		tests: string[];
	}[];
}

interface TestInfo {
	file: string;
	title: string;
}

export default class Suite {
	private readonly config: Setup
	private readonly file: string
	private prefix: string = ''
	private files: Map<string, string> = new Map<string, string>()
	private tests: Map<string, TestInfo> = new Map<string, TestInfo>()

	public constructor(file: string, logger?: Logger) {
		this.file = file
		this.config = setup(file, logger)
	}

	public async load(logger?: Logger): Promise<AVA.Status> {
		const reporter = new LoadReporter((report): void => {
			this.build(report, logger)
		}, this.config.match, logger)
		const c = {
			...this.config,
			match: ['']
		}
		return worker(c, {
			reporter,
			logger
		})
	}

	public collectInfo(send: (data: Tree) => void): void {
		send({
			type: 'prefix',
			id: '',
			file: this.file,
			prefix: this.prefix
		})
		for (const f of this.files) {
			send({
				type: 'file',
				id: f[0],
				config: '',
				file: f[1]
			})
		}
		for (const t of this.tests) {
			const { title, file } = t[1]
			send({
				type: 'case',
				id: t[0],
				file,
				test: title
			})
		}
	}

	private build(data: Loaded, _logger?: Logger): void {
		this.prefix = data.prefix
		for (const { file, tests } of data.info) {
			const id = hash(file, this.files.has.bind(this.files), 'f')
			this.files.set(id, file)
			for (const item of tests) {
				const h = hash(item, this.tests.has.bind(this.tests), 't', item.length.toString(16))
				this.tests.set(h, {
					file: id,
					title: item
				})
			}
		}
	}
}
