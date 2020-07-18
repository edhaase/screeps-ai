/** os.prog.mining.js */
'use strict';

/* global Log, MAX_CREEP_SPAWN_TIME */

const Process = require('/os/core/process');

class MiningProc extends Process {

	*run() {
		// Find sources, mine sources
		// Replaces owned structure extractor logic with locals
		// Prioritize local extractors, sector center, then SK rooms last
		// Only maintain threads for running stuff
		// Ignore extractors for minerals we're at capacity of
		// Power banks are a separate process
	
	}

}

module.exports = MiningProc;