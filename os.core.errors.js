/** os.core.errors.js */
'use strict';

/* global ENV */
const DEFAULT_STACK_TRACE_LIMIT = 30;

Error.stackTraceLimit = ENV('stackTraceLimit', DEFAULT_STACK_TRACE_LIMIT);

const { toString } = Error.prototype;
Error.prototype.toString = function () {
	return `${toString.apply(this, arguments)} (Tick ${Game.time})`;
};

class NotOwnerError extends Error {
	constructor(id) {
		super();
		this.id = id;
	}
}

class VisibilityError extends Error {
	constructor(roomName, filename, ln) {
		super(`No visibility in room ${roomName}`, filename, ln);
	}
}

class NoPathFoundError extends Error {
	constructor(params, filename, ln) {
		super(`No path found`, filename, ln);
	}
}

class AbortError extends Error {
	constructor() {
		super('Operation Aborted');
	}
}

class ActorHasCeased extends Error {
	constructor(actorName) {
		super();
		this.actorName = actorName;
	}
}

module.exports = {
	AbortError,
	ActorHasCeased, // For ITO objects

	NotOwnerError,
	NoPathFoundError,
	/* NotFoundError,
	NotEnoughResourcesError,
	InvalidArgumentsError */

	VisibilityError,


};