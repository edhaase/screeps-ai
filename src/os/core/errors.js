/** /os/core/errors.js */
'use strict';

import { ENV } from './macros';

/* global ENV */
const DEFAULT_STACK_TRACE_LIMIT = 30;

Error.stackTraceLimit = ENV('stackTraceLimit', DEFAULT_STACK_TRACE_LIMIT);

const { toString } = Error.prototype;
Error.prototype.toString = function () {
	return `${toString.apply(this, arguments)} (Tick ${Game.time})`;
};

export class NotOwnerError extends Error {
	constructor(id) {
		super();
		this.id = id;
	}
};

export class VisibilityError extends Error {
	constructor(roomName, filename, ln) {
		super(`No visibility in room ${roomName}`, filename, ln);
	}
};

export class NoPathFoundError extends Error {
	constructor(params, filename, ln) {
		super(`No path found`, filename, ln);
	}
};

export class InvalidDirectionError extends Error {

}

export class AbortError extends Error {
	constructor() {
		super('Operation Aborted');
	}
};

/** InterTick object is no longer valid */
export class ActorHasCeased extends Error {
	constructor(actorName) {
		super();
		this.actorName = actorName;
	}
};

/** Permissions error */
export class OperationNotPermitted extends Error {

};

export class TimeLimitExceeded extends Error {

};

/**
 * 
 */
export class LogicError extends Error {
	/** No other changes needed here */
};