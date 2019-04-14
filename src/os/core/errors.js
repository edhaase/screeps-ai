/** os.core.errors.js */
'use strict';

/* global ENV */
const DEFAULT_STACK_TRACE_LIMIT = 30;

Error.stackTraceLimit = ENV('stackTraceLimit', DEFAULT_STACK_TRACE_LIMIT);

const { toString } = Error.prototype;
Error.prototype.toString = function () {
	return `${toString.apply(this, arguments)} (Tick ${Game.time})`;
};

exports.NotOwnerError = class NotOwnerError extends Error {
	constructor(id) {
		super();
		this.id = id;
	}
};

exports.VisibilityError = class VisibilityError extends Error {
	constructor(roomName, filename, ln) {
		super(`No visibility in room ${roomName}`, filename, ln);
	}
};

exports.NoPathFoundError = class NoPathFoundError extends Error {
	constructor(params, filename, ln) {
		super(`No path found`, filename, ln);
	}
};

exports.AbortError = class AbortError extends Error {
	constructor() {
		super('Operation Aborted');
	}
};

/** InterTick object is no longer valid */
exports.ActorHasCeased = class ActorHasCeased extends Error {
	constructor(actorName) {
		super();
		this.actorName = actorName;
	}
};

/** Permissions error */
exports.OperationNotPermitted = class OperationNotPermitted extends Error {

};

exports.TimeLimitExceeded = class TimeLimitExceeded extends Error {

};

/**
 * 
 */
exports.LogicError = class LogicError extends Error {
	/** No other changes needed here */
};