/**
 * Log.js
 *
 * ES6 log class for logging screeps messages with color, where it makes sense.
 * @todo: abbr tag '<abbr title="World Health Organization">WHO</abbr>'
 * @todo: log groups / log levels?
 */
'use strict';

import { ROOM_LINK } from '/os/core/macros';
import { ENV } from '/os/core/macros';

export const LOG_LEVEL = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
	SUCCESS: 4
};

export const DEFAULT_LOG_LEVEL = ENV('log.default', LOG_LEVEL.WARN);

export class Log {
	constructor() {
		throw new Error("Log is a static class");
	}

	static debug(msg, tag) {
		this.log(LOG_LEVEL.DEBUG, msg, tag);
	}

	/** */
	static info(msg, tag) {
		this.log(LOG_LEVEL.INFO, msg, tag);
	}

	/** */
	static warn(msg, tag) {
		this.log(LOG_LEVEL.WARN, msg, tag);
	}

	/** */
	static error(msg, tag) {
		this.log(LOG_LEVEL.ERROR, msg, tag);
	}

	/** */
	static success(msg, tag) {
		this.log(LOG_LEVEL.SUCCESS, msg, tag);
	}

	/** */
	static log(level = LOG_LEVEL.DEBUG, msg, tag) {
		if (msg == null || msg === '')
			return;
		var color = Log.color[level];
		if (tag && this.getLogLevel(tag) > level)
			return;
		const out = msg.replace(/([WE])(\d+)([NS])(\d+)/gi, r => ROOM_LINK(r));
		this.toConsole(out, color, tag);
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
			return DEFAULT_LOG_LEVEL;
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
LOG_LEVEL.DEBUG = 0;
LOG_LEVEL.INFO = 1;
LOG_LEVEL.WARN = 2;
LOG_LEVEL.ERROR = 3;
LOG_LEVEL.SUCCESS = 4;

/** Log colors */
Log.color = {
	[LOG_LEVEL.DEBUG]: 'yellow',
	[LOG_LEVEL.INFO]: 'cyan',
	[LOG_LEVEL.WARN]: 'orange',
	[LOG_LEVEL.ERROR]: 'red',
	[LOG_LEVEL.SUCCESS]: 'green'
};

Object.freeze(Log);
Object.freeze(Log.color);