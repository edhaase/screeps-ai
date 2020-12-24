/**
 * 
 */
'use strict';

import * as Co from '/os/core/co';
import Process from '/os/core/process';
import { runTowersInRoom } from '/programs/lib/tower';

export default class ColonyProc extends Process {
	/**
	 * Starts and runs room specific threads
	 */
	*run() {
		this.rooms = new Map();
		while (true) {
			const myRooms = _.filter(Game.rooms, 'my');
			for (const r of myRooms) {
				if (this.rooms.has(r.name))
					continue;
				const thread = this.startThread(runTowersInRoom, [r.name], Process.PRIORITY_HIGH, `Tower thread ${r.name}`);
				this.rooms.set(r.name, thread);
			}
			this.title = `Holding ${this.rooms.size} room(s)`;
			yield this.sleepThread(25);
		}
	}	


}