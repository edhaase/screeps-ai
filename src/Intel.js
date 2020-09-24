/**
 * Intel.js
 * 
 * Evict if intel is over max age
 */
'use strict';

import { IS_SAME_ROOM_TYPE } from '/os/core/macros';
import { INVADER_USERNAME } from '/os/core/constants';
import { Log } from '/os/core/Log';
import { ENV } from '/os/core/macros';
import { PLAYER_STATUS } from '/Player';

const INTEL_MAX_AGE = 20000;

if (!Memory.intel) {
	Log.warn('Initializing intel memory', 'Memory');
	Memory.intel = {};
}

/**
 * Update intel for a room
 * @param {Room} room 
 */
export function scanRoom(room) {
	if (Room.getType(room.name) !== 'Room')
		return;
	const { controller = {} } = room;
	const prev = Memory.intel[room.name];
	const last = (prev && prev.tick) || NaN;
	const intel = {
		tick: Game.time,
		sources: room.sources.map(({ id, pos }) => ({ id, pos })) || [],
		owner: controller.owner && controller.owner.username,
		reservation: controller.reservation && controller.reservation.username,
		lastReservation: controller.reservation ? ({ user: controller.reservation.username, expire: Game.time + controller.reservation.ticksToEnd }) : (prev && prev.lastReservation),
		controller: controller.pos,
		level: controller.level,
		safeMode: controller.safeMode,
		safeModeCooldown: controller.safeModeCooldown,
		safeModeAvailable: controller.safeModeAvailable,
		powerEnabled: controller.isPowerEnabled || false,
		sign: controller.sign && _.escape(controller.sign.text),
		signed_by: controller.sign && controller.sign.username
	};
	if (intel && prev) {
		if (!intel.sign && prev.sign)
			Log.warn(`Sign removed in ${room.name}`, 'Intel');
		else if (intel.sign && intel.sign !== prev.sign)
			Log.warn(`Sign in ${room.name} changed to "${intel.sign}"`, 'Intel');
	}
	Memory.intel[room.name] = intel;
	// Log.info(`New intel report for ${room.name}: ${ex(intel)}`,'Intel');
	Log.debug(`New intel report for ${room.name} on ${Game.time} (last ${Game.time - last})`, 'Intel');
};

export function canHarvestRemoteSources(room) {
	if (room.my || !Memory.intel)
		return false;
	const { controller } = room;
	if (!controller || controller.owner)
		return false;
	//  Don't take a room we can't route too
	if (Memory.routing && Memory.routing.avoid && Memory.routing.avoid.includes(room.name))
		return false;
	// Don't take a room actively reserved by a friendly
	if (controller.reservation && Player.status(controller.reservation.username) >= PLAYER_STATUS.NEUTRAL
		&& controller.reservation.username !== WHOAMI && controller.reservation.username !== INVADER_USERNAME)
		return false;
	// Don't take a room recently reserved by a friendly (in case their remotes lag)
	const intel = Memory.intel[room.name];
	if (intel.lastReservation && Player.status(intel.lastReservation.user) >= PLAYER_STATUS.NEUTRAL && Game.time - intel.lastReservation.expire < 300
		&& intel.lastReservation.user !== WHOAMI && intel.lastReservation.user !== INVADER_USERNAME)
		return false;
	if (Room.getType(room.name) === 'SourceKeeper')
		return false;
	const exits = _.omit(Game.map.describeExits(room.name), (v, k) => !IS_SAME_ROOM_TYPE(room.name, v));
	if (!_.any(exits, exit => Game.rooms[exit] && Game.rooms[exit].my))
		return false;
	return ENV('empire.remote_mine', true);
};

export function setRoomOwner(roomName, owner) {
	if (!Memory.intel[roomName])
		Memory.intel[roomName] = {};
	Memory.intel[roomName].tick = Game.time;
	Memory.intel[roomName].owner = owner;
};

export function getRoomOwner(roomName) {
	const intel = getIntelForRoom(roomName) || {};
	return intel.owner;
}

/**
 * Call periodically to clean out old intel
 */
export function evict() {
	for (var i in Memory.intel) {
		if (Game.time - Memory.intel[i].tick < INTEL_MAX_AGE)
			continue;
		Log.info(`Purging old intel for room ${i}`, 'Intel');
		delete Memory.intel[i];
	}
};

export function getIntelForRoom(roomName) {
	return Memory.intel[roomName] || {};
};

export function getRoomStatus(roomName, includeSK = true) {
	if (includeSK && Room.getType(roomName) === 'SourceKeeper')
		return PLAYER_STATUS.HOSTILE;
	const intel = getIntelForRoom(roomName);
	if (intel && intel.owner)
		return Player.status(intel.owner);
	return PLAYER_STATUS.NEUTRAL;
}

export function isHostileRoom(roomName, includeSK = true) {
	return getRoomStatus(roomName, includeSK) === PLAYER_STATUS.HOSTILE;
};

export function hasOwner(roomName) {
	const intel = getIntelForRoom(roomName);
	if (!intel || !intel.owner)
		return false;
	return true;
};

export function isRoomNormal(roomName) {

}

export function isRoomClaimable(roomName, fromRoom) {
	// if (!IS_SAME_ROOM_TYPE(roomName, fromRoom) || Room.getType(roomName) !== 'Room')
	const roomStatus = Game.map.getRoomStatus(roomName);
	if (!roomStatus || roomStatus.status === 'closed' || Room.getType(roomName) !== 'Room')
		return false;
	const intel = getIntelForRoom(roomName);
	if (!intel)
		return false;
	if (intel.owner || intel.reservation)
		return false;
	return true;
};

/**
 * Lower was better
 * (!ownedRoom << 30) | (Math.min(dist, 63) << 24) | ((100 - task.priority) << 16) | Math.min(task.cost, 65535);
 * @todo still needs improvement
 * @todo account for remotes
 * @todo swamp score needs to be more complex. swamp outside the core is good, swamp under our planned roads would be bad
 */
export function scoreRoomForExpansion(roomName) {
	const { sources = [] } = getIntelForRoom(roomName);
	if (!isRoomClaimable(roomName))
		return 0.0;
	const terrainScore = Math.floor(100 * scoreTerrain(roomName));
	const sourceScore = 1 + (sources.length / 2); // Higher is better
	// const score = terrainScore * sourceScore;		
	const score = (sources.length << 16) || terrainScore << 8 || 1;
	return score;
};

/**
 * @return float 0 - 1 (Higher is better)
 */
export function scoreTerrain(roomName) {
	/* eslint-disable no-magic-numbers */
	var x, y, score = 0;
	const terrain = Game.map.getRoomTerrain(roomName);
	for (x = 2; x < 47; x++)
		for (y = 2; y < 47; y++)
			score += terrain.get(x, y) === 0; /* No obstacles */
	return score / 45 ** 2;
};

