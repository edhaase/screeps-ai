/** */
'use strict';

import { TOWER_MINIMUM_RESERVE } from '/prototypes/structure/tower';

const LOG_GROUP_TAG = 'Tower';

/**
 * 
 */
export function* runTowersInRoom(roomName) {
	Log.debug(`Starting tower group thread for room ${roomName} on tick ${Game.time}`, LOG_GROUP_TAG);
	while (true) {
		const room = Game.rooms[roomName];
		if (!room || !room.my)
			return Log.debug(`Shutting down defunct tower thread for room ${roomName}`, LOG_GROUP_TAG);
		const { intruders } = room;
		if (intruders && intruders.length) {
			Log.warn(`Hostiles found in room ${roomName}, engaging tower defense`, LOG_GROUP_TAG);
			try {
				yield* defendRoom(roomName);
			} catch (err) {
				Log.error(`Error defending room ${roomName}`, LOG_GROUP_TAG);
			}
		}
		const result = yield* healAndRepair(roomName);
		Log.debug(`Heal and repair result: ${result} ${roomName} on ${Game.time}`, 'Tower')
		if (!result) {
		// Hold off on yield until end of loop, so if we reset in the middle of combat
		// we resume at high alert
			yield this.sleepThread(_.random(7, 16));
		} else {
			yield false;
		}
	}
}

/**
 * Actively engage hostiles until they're gone
 */
const MAX_TOWER_ALERT_LEVEL = 7;
export function* defendRoom(roomName) {
	let alert_level = MAX_TOWER_ALERT_LEVEL;
	while (alert_level > 0) {
		alert_level--;
		const room = Game.rooms[roomName];
		if (!room || !room.my)
			return;
		const { intruders } = room;
		if (intruders && intruders.length) {
			alert_level = MAX_TOWER_ALERT_LEVEL; // As long as we actively have hostiles, we're at max alert level
			const towers = room.structuresByType[STRUCTURE_TOWER];
			for (const tower of towers) {
				if (tower.energy < TOWER_ENERGY_COST || tower.isDeferred() || tower.isBusy)
					continue;
				tower.runAttack();
				// yield true; // Only continue if we still have cpu
			}
		}
		// Stay on alert for several ticks
		yield;
	}
	Log.debug(`[${roomName}] Conflict resolved`, LOG_GROUP_TAG);
}

/**
 * 
 * @param {*} roomName 
 */
export function* healAndRepair(roomName) {
	const towers = Game.rooms[roomName].structuresByType[STRUCTURE_TOWER] || [];
	let status = false;
	for (const tower of towers) {
		yield true; // Only continue if we still have cpu
		if (tower.energyPct <= TOWER_MINIMUM_RESERVE || tower.isDeferred() || tower.isBusy)
			continue;
		if (tower.runHeal() || tower.runRepair())
			status = true;
	}
	return status;
}