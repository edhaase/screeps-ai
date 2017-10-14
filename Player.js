/**
 * Player.js - Allows for whitelisting players.
 */
"use strict";

global.PLAYER_HOSTILE = 0;		// REMOVE THEM.
global.PLAYER_NEUTRAL = 1;		// IGNORE THEM.
global.PLAYER_TRUSTED = 2;		// Maybe they aren't so bad.
global.PLAYER_ALLY = 3;

module.exports = {

	set: function (name, state = PLAYER_HOSTILE) {
		if (!Memory.players)
			Memory.players = {};
		Memory.players[name] = state;
		Log.notify(`Player ${name} status set to ${state}`);
	},

	status: function (name) {
		if (name === WHOAMI)
			return PLAYER_ALLY;
		if (!Memory.players || !Memory.players[name])
			return PLAYER_HOSTILE;
		return Memory.players[name];
	},

	reset: function () {
		Memory.players = undefined;
	}

};