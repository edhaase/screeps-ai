/**
 * role.thief.js - Acqusitions department. Steals resources and brings them home.
 * @todo target lock hostile structures
 * @todo flee threats?
 * @todo replace with thievery process and haulers
 */
'use strict';

import Body from '/ds/Body';
import { unauthorizedHostile, droppedResources } from '/lib/filter';
import { Log, LOG_LEVEL } from '/os/core/Log';
import { findClosestRoomByRoute } from '/algorithms/map/closest';
import { distinct } from '/lib/util';

const MIN_WAIT = 1;
const MAX_WAIT = 7;
const MAX_OPS = 64000;

global.LOOT_ROOMS = new Set();
global.LOOT_TARGETS = new Map();

/**
 * Avoid hostile rooms in safe mode
 * 
 * @param {*} room 
 */
export function thief_can_loot_room(room) {
	const { controller } = room;
	if (!controller || controller.my)
		return true;
	if (controller.safeMode || controller.owner)
		return false;
	if (controller.reservation)
		return (controller.reservation.username === WHOAMI);
	return true;
}

export function thief_candidate_filter(s) {
	if (s.storedNonEnergyResources <= 0)
		return false;
	if (s.my && s.isActive())
		return false;
	if (!s.my && s.owner && !unauthorizedHostile(s))
		return false;
	// Avoid things with ramparts
	return s.pos.hasWithdrawAccess();
}

// Is knowing the room enough, or should we track the entire candidate object?

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function ({ room }) {
		return Body.repeat([CARRY, MOVE], room.energyCapacityAvailable);
	},
	init: function () {

	},
	/* eslint-disable consistent-return */
	run: function () {
		if (!LOOT_TARGETS || !LOOT_TARGETS.size) {
			Log.warn(`${this.name}/${this.pos} No targets`, 'Creep');
			this.say('?');
			if (this.pos.findInRange(FIND_MY_SPAWNS, 1).length)
				this.scatter(); // Don't renew if we have zero targets total
			else
				this.defer(_.random(MIN_WAIT, MAX_WAIT));
			return;
		}

		// We have possible targets. Make sure we have enough life to raid them
		if (this.ttlPct < 0.5 || Math.random() > this.ttlPct)
			return this.pushState('RenewSelf', {});

		const maxSourceCost = Math.floor(this.ticksToLive * 0.60);
		const candidates = [...LOOT_TARGETS.values()];
		const source = this.pos.findClosestByPathFinder(candidates, (pos) => ({ pos, range: 1 }), {
			maxCost: maxSourceCost,
			maxOps: MAX_OPS
		});
		if (!source.goal || source.incomplete) { // We have targets but none we can reach
			const candidateRooms = distinct(candidates, c => c.roomName);
			const [candidate, distance] = findClosestRoomByRoute(this.pos.roomName, candidateRooms);  // find closest room to raid
			if (!candidate) {
				Log.warn(`${this.name}/${this.pos} No reachable loot room`, 'Creep');
				this.defer(_.random(MIN_WAIT, MAX_WAIT));
			} else {
				const spawnRooms = distinct(Game.spawns, s => s.pos.roomName);
				const [forwardOps, distance] = findClosestRoomByRoute(candidate, spawnRooms);
				// const forwardOps = _.min(Game.spawns, s => Game.map.getRoomLinearDistance(s.pos.roomName, candidate, false));	// find closest
				if (forwardOps) {
					// Log.warn(`${this.name}/${this.pos} No targets found in range ${maxSourceCost}, migrating to ${forwardOps}/${forwardOps.pos} to loot ${candidate}`, 'Creep');
					// this.pushState('EvadeMove', { pos: forwardOps.pos, range: 1 });
					Log.warn(`${this.name}/${this.pos} No targets found in range ${maxSourceCost}, migrating to ${forwardOps} to loot ${candidate}`, 'Creep');
					this.pushState('MoveToRoom', forwardOps);
				} else {
					Log.warn(`${this.name}/${this.pos} No targets found in range ${maxSourceCost}`, 'Creep');
					this.defer(_.random(MIN_WAIT, MAX_WAIT));
				}
			}
			return;
		}
		const terminals = _(Game.rooms).filter('my').map('terminal').compact().filter(t => t.storedPct < 1.0).value();
		const margin = 25; // in ticks
		const dest = source.goal.findClosestByPathFinder(terminals, ({ pos }) => ({ pos, range: 1 }), {
			maxCost: this.ticksToLive - source.cost - margin,
			maxOps: MAX_OPS
		});
		if (!dest.goal || dest.incomplete) {
			Log.warn(`${this.name}/${this.pos} No dropoff point!`, 'Creep');
			return this.defer(15);
		}

		const totalCost = source.cost + dest.cost;
		Log.warn(`${this.name}/${this.pos} wants to steal from ${source.goal} and deliver to ${dest.goal} at ${dest.goal.pos} (est ${totalCost} ticks / ${this.ticksToLive})`, 'Creep');

		this.pushStates([
			// ['RenewSelf', {}], // Life affects max pathfinding range, so renew before trying to head back out
			['Unload', null],
			['EvadeMove', { pos: dest.goal.pos, range: 1 }],
			['WithdrawAllFromPos', { pos: source.goal, avoid: [RESOURCE_ENERGY] }],
			['EvadeMove', { pos: source.goal, range: 1 }],
		]);
		const mult = 1.05;
		if (mult * (source.cost + dest.cost) > this.ticksToLive)
			this.pushState('RenewSelf', {});
	}
};

