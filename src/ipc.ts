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

interface Base<T extends string> {
	type: T;
}

export interface Logging extends Base<'log'> {
	enable: boolean;
}

export interface Port extends Base<'port'> {
	port: number;
}

export interface Load extends Base<'load'> {
	file: string;
}

export interface Drop extends Base<'drop'> {
	id: string;
}

export interface Prefix extends Base<'prefix'> {
	id: string;
	file: string;
	prefix: string;
}

export interface TestFile extends Base<'file'> {
	id: string;
	config: string;
	file: string;
}

export interface TestCase extends Base<'case'> {
	id: string;
	file: string;
	test: string;
}

export interface Run extends Base<'run'> {
	run: string[];
}

export type Stop = Base<'stop'>

export interface Result extends Base<'result'> {
	test: string;
	state: 'running' | 'passed' | 'failed' | 'skipped' | 'errored';
}

export interface Done extends Base<'done'> {
	file: string;
}

export interface Debug extends Base<'debug'> {
	run: string[];
}

export type Ready = Base<'ready'>

export type Action = Load | Drop | Run | Stop | Debug

export type Parent = Action | Logging | Port

export type Tree = Prefix | TestFile | TestCase

export type Event = Result | Done

export type Child = Tree | Event

