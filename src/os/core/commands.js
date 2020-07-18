/** os-commands.js - Global console commands */
'use strict';

/* global MAKE_CONSTANT */

import { MAKE_CONSTANT } from '/os/core/macros';

import * as Inspector from '/os/core/ins/inspector';

const COMMANDS = {};
export function register(name, fn, desc = '-', aliases = [], category) {
	if (!Array.isArray(aliases))
		throw new TypeError(`Expected alias array on ${name}`);
	MAKE_CONSTANT(global, name, fn);
	const args = Inspector.getParamStr(fn);
	COMMANDS[name] = [fn, desc, aliases || [], category, args];
	for (const alias of aliases) {
		MAKE_CONSTANT(global, alias, fn);
	}
};

export function showFull() {
	var body = '';
	const sorted = _.sortByOrder(Object.entries(COMMANDS), x => x[0], ['asc']);
	const groups = _.groupBy(sorted, x => x[1][3] || '*');
	const sortedGroups = _.sortByOrder(Object.entries(groups), x => x[0], ['asc']);
	for (const [category, commands] of sortedGroups) {
		if (category !== '*')
			body += `<tr></tr><tr><td colspan=3><center><font color='green'>${category}</font></center></td></tr>`;
		for (const [name, [, desc, aliases, , args]] of commands) {
			body += `<tr><td>${name}</td><td>${desc}</td><td>${aliases.join(',')}<td><td>${args}</td></tr>`;
		}
	}
	const head = `<tr><th>Name</th><th>Desc</th><th>Aliases</th><th>Params</th></tr>`;
	return `<table style='width: 50vw'><thead>${head}<thead><tbody>${body}</tbody></table>`;
};

export function showBrief() {
	var body = '';
	const sorted = _.sortByOrder(Object.entries(COMMANDS), x => x[0], ['asc']);
	const groups = _.groupBy(sorted, x => x[1][3] || '*');
	const sortedGroups = _.sortByOrder(Object.entries(groups), x => x[0], ['asc']);
	for (const [category, commands] of sortedGroups) {
		if (category !== '*')
			body += `<tr></tr><tr><td colspan=3><center><font color='green'>${category}</font></center></td></tr>`;
		for (const [name, [, desc, aliases]] of commands) {
			body += `<tr><td>${name}</td><td>${desc}</td><td>${aliases.join(',')}<td></tr>`;
		}
	}
	const head = `<tr><th>Name</th><th>Desc</th><th>Aliases</th></tr>`;
	return `<table style='width: 30vw'><thead>${head}<thead><tbody>${body}</tbody></table>`;
};

export function list(full = false) {
	return (full) ? showFull() : showBrief();
};

/** Load one default command */
register('help', function (full = false) {
	return list(full);
}, 'Show available commands');