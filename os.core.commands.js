/** os-commands.js - Global console commands */
'use strict';

/* global MAKE_CONSTANT */

const COMMANDS = {};
exports.register = function register(name, fn, desc = '-', aliases = []) {
	MAKE_CONSTANT(global, name, fn);
	COMMANDS[name] = [fn, desc, aliases];
	for (const alias of aliases) {
		MAKE_CONSTANT(global, alias, fn);
	}
};

exports.list = function () {
	var body = '';
	const sorted = _.sortByOrder(Object.entries(COMMANDS), x => x[0], ['asc']);
	for (const [name, [, desc,aliases]] of sorted) {
		body += `<tr><td>${name}</td><td>${desc}</td><td>${aliases.join(',')}<td></tr>`;
	}
	const head = `<tr><th>Name</th><th>Desc</th><th>Aliases</th></tr>`;
	return `<table style='width: 30vw'><thead>${head}<thead><tbody>${body}</tbody></table>`;
};

/** Load one default command */
exports.register('help', function () {
	return exports.list();
}, 'Show available commands');