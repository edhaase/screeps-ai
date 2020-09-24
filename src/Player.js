/**
 * Player.js - Allows for whitelisting players.
 */
'use strict';

import { Log } from '/os/core/Log';

export const PLAYER_STATUS = {
	HOSTILE: -1,
	NEUTRAL: 0,
	TRUSTED: 1,
	ALLY: 2
};

export default {

	set: function (name, state = PLAYER_STATUS.HOSTILE) {
		if (!Memory.players)
			Memory.players = {};
		Memory.players[name] = state;
		Log.notify(`Player ${name} status set to ${state}`);
	},

	status: function (name) {
		if (name === WHOAMI)
			return PLAYER_STATUS.ALLY;
		if (!Memory.players || !Memory.players[name])
			return PLAYER_STATUS.NEUTRAL;
		return Memory.players[name];
	},

	reset: function () {
		Memory.players = undefined;
	}

};