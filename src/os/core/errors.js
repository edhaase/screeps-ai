/**
 * @module
 */
import { ENV } from './macros';

/**
 * @constant
 * @default 30
 */
export const DEFAULT_STACK_TRACE_LIMIT = 30;

Error.stackTraceLimit = ENV('stackTraceLimit', DEFAULT_STACK_TRACE_LIMIT);

const { toString } = Error.prototype;
Error.prototype.toString = function () {
	return `${toString.apply(this, arguments)} (Tick ${Game.time})`;
};

/**
 * @classdesc
 */
export class NotOwnerError extends Error {
	constructor(id) {
		super();
		this.id = id;
	}
};

/**
 * @classdesc
 */
export class VisibilityError extends Error {
	constructor(roomName, filename, ln) {
		super(`No visibility in room ${roomName}`, filename, ln);
	}
};

/**
 * @classdesc
 */
export class NoPathFoundError extends Error {
	constructor(params, filename, ln) {
		super(`No path found`, filename, ln);
	}
};

/**
 * @classdesc
 */
export class InvalidDirectionError extends Error {

};

/**
 * @classdesc
 */
export class AbortError extends Error {
	constructor() {
		super('Operation Aborted');
	}
};

/**
 * @classdesc InterTick object is no longer valid
 */ 
export class ActorHasCeasedError extends Error {
	constructor(actorName) {
		super();
		this.actorName = actorName;
	}
};

/** 
 * @classdesc Permissions error
 */
export class OperationNotPermittedError extends Error {

};

/**
 * @classdesc
 */
export class TimeLimitExceededError extends Error {

};

/**
 * @classdesc
 */
export class LogicError extends Error {
	/** No other changes needed here */
};