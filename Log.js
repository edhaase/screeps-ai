/**
 * Log.js
 *
 * ES6 log class for logging screeps messages with color, where it makes sense.
 * @todo: abbr tag '<abbr title="World Health Organization">WHO</abbr>'
 * @todo: log groups / log levels?
 */
'use strict';

class Log {
	constructor() {
		throw new Error("Log is a static class");
	}

	static debug(msg, tag) {
		this.log(Log.LEVEL_DEBUG, msg, tag);
	}

	/** */
	static info(msg, tag) {
		this.log(Log.LEVEL_INFO, msg, tag);
	}

	/** */
	static warn(msg, tag) {
		this.log(Log.LEVEL_WARN, msg, tag);
	}

	/** */
	static error(msg, tag) {
		this.log(Log.LEVEL_ERROR, msg, tag);
	}

	/** */
	static success(msg, tag) {
		this.log(Log.LEVEL_SUCCESS, msg, tag);
	}

	/** */
	static log(level = Log.LEVEL_DEBUG, msg, tag) {
		var color = Log.color[level];
		if (tag && this.getLogLevel(tag) > level)
			return;
		this.toConsole(msg, color, tag);
	}

	/**
	 * HTML table in console
	 * ex: Log.table(['a','b'], [[1,2],[3,4]])
	 */
	static table(headers, rows) {

		let msg = '<table>';
		_.each(headers, h => msg += '<th width="50px">' + h + '</th>');
		_.each(rows, row => msg += '<tr>' + _.map(row, el => (`<th>${el}</th>`)) + '</tr>');
		msg += '</table>';
		// console.log(msg);
		return msg;
	}

	/** */
	static notify(msg, group = 0, color = 'red') {
		this.toConsole(msg, color);
		Game.notify(msg, group);
	}

	/** */
	static getLogLevel(tag) {
		if (!Memory.logging)
			Memory.logging = {};
		if (Memory.logging[tag] == null)
			return Log.LEVEL_WARN;
		return Memory.logging[tag];
	}

	/** */
	static toConsole(msg, color, tag) {
		if (tag)
			console.log(`<font color=${color}>[${tag}] ${msg}</font>`);
		else
			console.log(`<font color=${color}>${msg}</font>`);
	}

	/** */
	static progress(v, m) {
		return `<progress value="${v}" max="${m}"/>`;
	}

}

/** Log levels */
Log.LEVEL_DEBUG = 0;
Log.LEVEL_INFO = 1;
Log.LEVEL_WARN = 2;
Log.LEVEL_ERROR = 3;
Log.LEVEL_SUCCESS = 4;

/** Log colors */
Log.color = {
	[Log.LEVEL_DEBUG]: 'yellow',
	[Log.LEVEL_INFO]: 'cyan',
	[Log.LEVEL_WARN]: 'orange',
	[Log.LEVEL_ERROR]: 'red',
	[Log.LEVEL_SUCCESS]: 'green'
};

Object.freeze(Log);
Object.freeze(Log.color);

module.exports = Log;