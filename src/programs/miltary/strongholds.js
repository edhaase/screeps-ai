/**
 * For breaking strongholds
 * 
 * @todo find strongholds - mark the tick it decays on
 * @todo find out if they have something we want or can sell
 * @todo estimate whether or not we can take it
 * @todo start combat process - must leave loot behind
 * 
 * Ideas: power creep shield: 
 */
'use strict';

const Process = require('/os/core/process');

export default class Strongholds extends Process {

	*run() {
		while (true) {
			yield;
		}
	}

}