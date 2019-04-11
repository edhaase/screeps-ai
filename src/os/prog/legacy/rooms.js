/** prog-legacy.js */
'use strict';

const Process = require('os.core.process');

class LegacyRooms extends Process {

	*run() {
		while (true) {
			yield _.invoke(Game.rooms, 'run');
		}
	}

}

module.exports = LegacyRooms;