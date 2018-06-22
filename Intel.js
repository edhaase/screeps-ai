/**
 * Intel.js
 * 
 * Evict if intel is over max age
 */
'use strict';

const INTEL_MAX_AGE = 20000;

if(!Memory.intel) {
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
		Log.info(`New intel report for ${room.name}`, 'Intel');
	}

	static setRoomOwner(roomName, owner) {
		if(!Memory.intel[roomName])
			Memory.intel[roomName] = {};
		Memory.intel[roomName].tick = Game.time;
		Memory.intel[roomName].owner = owner;
	}

	/**
	 * Call periodically to clean out old intel
	 */
	static evict() {
		for( var i in Memory.intel ) {
			if(Game.time - Memory.intel[i].tick < INTEL_MAX_AGE)
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
		if(Room.getType(roomName) === 'SourceKeeper')
			return true;
		const intel = this.getIntelForRoom(roomName);
		if(intel && intel.owner && Player.status(intel.owner) === PLAYER_HOSTILE)
			return true;
		return false;
	}

	/**
	 * Lower was better
	 * (!ownedRoom << 30) | (Math.min(dist, 63) << 24) | ((100 - task.priority) << 16) | Math.min(task.cost, 65535);
	 * @todo still needs improvement
	 */
	static scoreRoomForExpansion(roomName) {
		const {sources=[],owner} = this.getIntelForRoom(roomName);
		if(owner && owner !== WHOAMI)
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
		for (x = 2; x < 47; x++)
			for (y = 2; y < 47; y++)
				score += (Game.map.getTerrainAt(x, y, roomName) === 'plain');
		return score / 45 ** 2;
	}

}

module.exports = Intel;