import * as Cmd from '/os/core/commands';
import { can_we_harvest_commodity, MINIMUM_TTL_TO_HARVEST_COMMODITY } from '/role/economy/charvest';
import { canHarvestRemoteSources } from '/Intel';
import { distinct } from '/lib/util';
import { findClosestRoomByRoute } from '/algorithms/map/closest';
import { Log } from '/os/core/Log';
import { thief_can_loot_room, thief_candidate_filter } from '/role/military/thief';

const CMD_CATEGORY = 'Intel';
export const MAX_COMMODITY_RANGE = 4;

/**
 * @todo check reservation history in case neighbor is bad about keeping up the reservation
 * 
 * @param {*} room 
 */
export function markCandidateForRemoteMining(room) {
	const { controller } = room;
	if (!canHarvestRemoteSources(room))
		return false;
	Log.debug(`Intel wants ${room.name} for remote mining as it's near our empire`, 'Intel');
	room.find(FIND_SOURCES).forEach(s => {
		s.pos.createLogicFlag(null, FLAG_ECONOMY, SITE_REMOTE);
		s.pos.createLogicFlag(null, FLAG_ECONOMY, SITE_PICKUP);
	});
	controller.pos.createLogicFlag(null, FLAG_MILITARY, STRATEGY_RESERVE);
	controller.pos.createLogicFlag(null, FLAG_MILITARY, STRATEGY_RESPOND);
	return true;
};

/**
 * 
 * @param {*} room 
 */
export function markCandidateForCommodityMining(room) {
	const deposits = room.find(FIND_DEPOSITS, { filter: c => can_we_harvest_commodity(c) && !c.pos.hasFlag(FLAG_ECONOMY, SITE_DEPOSIT) });
	if (!deposits || !deposits.length)
		return false;
	const avail = _.filter(Game.spawns, s => s.isActive() && !!s.room.terminal);
	if (!avail || !avail.length)
		return false;
	const spawnRooms = distinct(avail, s => s.pos.roomName);
	const [spawnRoom, distance] = findClosestRoomByRoute(room.name, spawnRooms);
	if (!spawnRoom || distance > MAX_COMMODITY_RANGE)
		return false;
	for (const deposit of deposits) {
		const status = deposit.pos.createLogicFlag(null, FLAG_ECONOMY, SITE_DEPOSIT);
		if (status !== ERR_FULL)
			Log.info(`Intel wants deposit at ${deposit.pos} for commodity harvesting supported by room ${spawnRoom}`, 'Intel');
	}
};

/**
 * Refresh list of lootable targets for room
 * 
 * @param {*} room 
 */
export function markCandidateForLooting(room) {
	// Remove old target data for room
	for (const [id, pos] of LOOT_TARGETS) {
		if (pos.roomName === room.name)
			LOOT_TARGETS.delete(id);		
	}
	if (!thief_can_loot_room(room))
		return LOOT_ROOMS.delete(room.name);
	const s = room.find(FIND_STRUCTURES, { filter: thief_candidate_filter }) || [];
	const r = room.find(FIND_RUINS, { filter: thief_candidate_filter }) || [];
	if (!s.length && !r.length)
		return;
	LOOT_ROOMS.add(room.name);
	s.forEach(ds => LOOT_TARGETS.set(ds.id, ds.pos));
	r.forEach(dr => LOOT_TARGETS.set(dr.id, dr.pos));
};


Cmd.register('markCandidateForRemoteMining', markCandidateForRemoteMining, 'Mark a remote room for source mining', ['mcrm'], CMD_CATEGORY);
Cmd.register('markCandidateForCommodityMining', markCandidateForCommodityMining, 'Mark a remote room for commodity mining', ['mccm'], CMD_CATEGORY);
Cmd.register('markCandidateForLooting', markCandidateForLooting, 'Mark a remote room for looting', ['mcl'], CMD_CATEGORY);