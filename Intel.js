/**
 * Intel.js
 * 
 * Evict if intel is over max age
 */
'use strict';

const INTEL_MAX_AGE = 20000;

if (!Memory.intel) {
	Log.warn('Initializing intel memory', 'Memory');
	Memory.intel = {};
}

class Intel {
	get memory() { return Memory.intel; }
	/**
	 * Update intel for a room
	 * @param {Room} room 
	 */
	static scanRoom(room) {
		if (Room.getType(room.name) !== 'Room')
			return;
		const { controller = {} } = room;
		const intel = {
			tick: Game.time,
			sources: room.sources.map(({ id, pos }) => ({ id, pos })) || [],
			owner: controller.owner && controller.owner.username,
			reservation: controller.reservation && controller.reservation.username,
			controller: controller.pos,
			level: controller.level,
			safeMode: controller.safeMode,
			safeModeCooldown: controller.safeModeCooldown,
			safeModeAvailable: controller.safeModeAvailable
		};
		Memory.intel[room.name] = intel;
		// Log.info(`New intel report for ${room.name}: ${ex(intel)}`,'Intel');
		Log.debug(`New intel report for ${room.name}`, 'Intel');
	}

	static markCandidateForRemoteMining(room) {
		if (room.my || !Memory.empire)
			return false;
		const { controller } = room;
		if (!controller || controller.owner)
			return false;
		if (controller.reservation && Player.status(controller.reservation.username) >= PLAYER_NEUTRAL && controller.reservation.username !== WHOAMI)
			return false;
		if (Room.getType(room.name) === 'SourceKeeper')
			return false;
		const exits = _.omit(Game.map.describeExits(room.name), (v, k) => !Game.map.isRoomAvailable(v));
		if (!_.any(exits, exit => Game.rooms[exit] && Game.rooms[exit].my))
			return false;
		Log.info(`Intel wants ${room.name} for remote mining as it's near our empire`, 'Intel');
		if (!Memory.empire.remoteMine)
			return false;
		room.find(FIND_SOURCES).forEach(s => {
			s.pos.createLogicFlag(null, FLAG_MINING, SITE_REMOTE);
			s.pos.createLogicFlag(null, FLAG_MINING, SITE_PICKUP);
		});
		controller.pos.createLogicFlag(null, FLAG_MILITARY, STRATEGY_RESERVE);
		controller.pos.createLogicFlag(null, FLAG_MILITARY, STRATEGY_RESPOND);
		return true;
	}

	static setRoomOwner(roomName, owner) {
		if (!Memory.intel[roomName])
			Memory.intel[roomName] = {};
		Memory.intel[roomName].tick = Game.time;
		Memory.intel[roomName].owner = owner;
	}

	/**
	 * Call periodically to clean out old intel
	 */
	static evict() {
		for (var i in Memory.intel) {
			if (Game.time - Memory.intel[i].tick < INTEL_MAX_AGE)
				continue;
			Log.info(`Purging old intel for room ${i}`, 'Intel');
			delete Memory.intel[i];
		}
	}

	static getIntelForRoom(roomName) {
		return Memory.intel[roomName] || {};
	}

	static isHostileRoom(roomName) {
		/* global Player, PLAYER_HOSTILE */
		if (Room.getType(roomName) === 'SourceKeeper')
			return true;
		const intel = this.getIntelForRoom(roomName);
		if (intel && intel.owner && Player.status(intel.owner) === PLAYER_HOSTILE)
			return true;
		return false;
	}

	static hasOwner(roomName) {
		const intel = this.getIntelForRoom(roomName);
		if (!intel || !intel.owner)
			return false;
		return true;
	}

	static isClaimable(roomName) {
		if (!Game.map.isRoomAvailable(roomName) || Room.getType(roomName) !== 'Room')
			return false;
		const intel = this.getIntelForRoom(roomName);
		if (!intel)
			return false;
		if (intel.owner || intel.reservation)
			return false;
		return true;
	}

	/**
	 * Lower was better
	 * (!ownedRoom << 30) | (Math.min(dist, 63) << 24) | ((100 - task.priority) << 16) | Math.min(task.cost, 65535);
	 * @todo still needs improvement
	 */
	static scoreRoomForExpansion(roomName) {
		const { sources = [] } = this.getIntelForRoom(roomName);
		if (!this.isClaimable(roomName))
			return 0.0;
		const terrainScore = Math.floor(100 * this.scoreTerrain(roomName));
		const sourceScore = 1 + (sources.length / 2); // Higher is better
		// const score = terrainScore * sourceScore;		
		const score = (sources.length << 16) || terrainScore << 8 || 1;
		return score;
	}

	/**
	 * @return float 0 - 1 (Higher is better)
	 */
	static scoreTerrain(roomName) {
		/* eslint-disable no-magic-numbers */
		var x, y, score = 0;
		const terrain = Game.map.getRoomTerrain(roomName);
		for (x = 2; x < 47; x++)
			for (y = 2; y < 47; y++)
				score += terrain.get(x, y) === 0; /* No obstacles */
		return score / 45 ** 2;
	}

}

module.exports = Intel;