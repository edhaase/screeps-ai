/** prog-legacy.js */
'use strict';

const Process = require('/os/core/process');

class LegacyRooms extends Process {

	*run() {
		while (true) {
			_.invoke(Game.rooms, 'run');
			yield;
		}
	}

}

module.exports = LegacyRooms;