/**
 * Process to harvest out a mineral, owned or SK
 * 
 * Exits when mineral regen timer starts
 */
'use strict';

import Process from '/os/core/process';
import { runCensus } from '/lib/util';

export default class HarvestProc extends Process {

	*run() {
		// Acquire missing data
		// Build container, maintain while in use
		// Acquire harvesters, haulers. Tow into place.
		// Calculate lane size directly to nearest terminal

		const { roomName } = this.memory;
		this.title = 'Awaiting room vision';
		const room = yield Intel.getRoom(roomName);	// Wait until we can see the room

		this.title = `Checking conditionals`;
		const [extractor] = room.structuresByType[STRUCTURE_EXTRACTOR];
		if (!extractor || !extractor.mineral)
			return this.error(`No extractor in ${roomName}, nothing to do, exiting`);
		const { mineral } = extractor;
		if (mineral.mineralAmount === 0 && mineral.ticksToRegeneration > MAX_CREEP_SPAWN_TIME) {
			return this.info(`Mineral site at ${mineral.pos} empty. Exiting.`, 'Extractor');
		}
		const terminal = this.findDropoff(extractor.pos);
		if (!terminal)
			return this.error(`No terminal to deliver to`);

		this.title = `Resource ${mineral.type} to ${terminal.pos.roomName}`;
		this.startThread(this.loop, undefined, undefined, `Mining`);
	}

	*loop() {
		while( !(yield) ) {
			// loop
			yield* this.holdRoom(); // Only if SK lair nearby
			yield* this.ensureContainer();
			yield* this.buildHarvesters();
			yield* this.buildHaulers();
		}
	}

	*holdRoom() {

	}

	*ensureContainer() {

	}

	findDropoff(from) {
		const terminal = Game.getObjectById(this.memory.terminal);
		if (terminal)
			return terminal;
		const terminals = _.filter(Game.structures, 'structureType', STRUCTURE_TERMINAL);
		const { goal, cost, ops, incomplete } = from.findClosestByPathFinder(terminals, s => ({ pos: s.pos, range: 1 }));
		if (!goal)
			return null;
		this.memory.terminal = goal.id;
		this.memory.terminalPos = goal.pos;
		return goal;
	}
	
}