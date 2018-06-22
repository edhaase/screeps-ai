/** Error.js */
'use strict';

// Error.stackTraceLimit = Infinity;
Error.stackTraceLimit = 30;

class VisibilityError extends Error {
	constructor(roomName, filename, ln) {
		super(`No visibility in room ${roomName}`, filename, ln);	
	}
}

class NoPathFoundError extends Error
{
	constructor(params, filename, ln) {
		super(`No path found`, filename, ln);
		// var { path, incomplete, cost, ops } = result
		//Log.warn(`No path to goal ${params.toPos} cost ${cost} ops ${ops} steps ${path.length}`, 'Planner');
	}
}

module.exports = {
	VisibilityError
};