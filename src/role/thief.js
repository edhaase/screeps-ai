/**
 * role.thief.js - Acqusitions department. Steals resources and brings them home.
 * @todo: target lock hostile structures
 * @todo: flee threats?
 */
'use strict';

const MIN_WAIT = 1;
const MAX_WAIT = 7;
const MAX_OPS = 64000;

function canLootRoom(room) {
	const { controller } = room;
	if (!controller || controller.my)
		return true;
	if (controller.safeMode || controller.owner)
		return false;
	if (controller.reservation)
		return (controller.reservation.username === WHOAMI);
	return true;
}

module.exports = {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {

	},
	/* eslint-disable consistent-return */
	run: function () {
		// Avoid things with ramparts
		// Avoid hostile rooms in safe mode
		// Periodically refresh if we have targets
		// Heal state handled when idle

		// @todo Keep track of loot rooms and check them again if we aren't certain

		const rooms = _.filter(Game.rooms, canLootRoom); // Just, don't even try if it's safe moded.

		const structures = _.flatten(_.map(rooms, r => r.find(FIND_HOSTILE_STRUCTURES, { filter: s => (s.storedNonEnergyResources > 0 || s.power) && (!s.owner || s.owner.username === 'Screeps') && !s.pos.hasRampart(x => !x.isPublic) })));
		const ruins = _.flatten(_.map(rooms, r => r.find(FIND_RUINS, { filter: s => (s.storedNonEnergyResources > 0 || s.power) && (!s.owner || s.owner.username === 'Screeps') && !s.pos.hasRampart(x => !x.isPublic) })));
		const candidates = structures.concat(ruins);
		if (_.isEmpty(candidates)) {
			Log.warn(`${this.name}/${this.pos} No visible targets`, 'Creep');
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
		const source = this.pos.findClosestByPathFinder(candidates, ({ pos }) => ({ pos, range: 1 }), {
			maxCost: maxSourceCost,
			maxOps: MAX_OPS
		});
		if (!source.goal || source.incomplete) { // We have targets but none we can reach
			const candidate = _.min(candidates, c => Game.map.getRoomLinearDistance(c.pos.roomName, this.pos.roomName, false)); // find closest room to raid
			const forwardOps = _.min(Game.spawns, s => Game.map.getRoomLinearDistance(s.pos.roomName, candidate.pos.roomName, false));	// find closest
			if (candidate && forwardOps) {
				Log.warn(`${this.name}/${this.pos} No targets found in range ${maxSourceCost}, migrating to ${forwardOps}/${forwardOps.pos}`, 'Creep');
				return this.pushState('EvadeMove', { pos: forwardOps.pos, range: 1 });
			} else {
				Log.warn(`${this.name}/${this.pos} No targets found in range ${maxSourceCost}`, 'Creep');
				this.defer(_.random(MIN_WAIT, MAX_WAIT));
			}
			return;
		}
		const terminals = _(Game.rooms).filter('my').map('terminal').compact().filter(t => t.storedPct < 1.0).value();
		const margin = 25; // in ticks
		const dest = source.goal.pos.findClosestByPathFinder(terminals, ({ pos }) => ({ pos, range: 1 }), {
			maxCost: this.ticksToLive - source.cost - margin,
			maxOps: MAX_OPS
		});
		if (!dest.goal || dest.incomplete) {
			Log.warn(`${this.name}/${this.pos} No dropoff point!`, 'Creep');
			return this.defer(15);
		}

		const totalCost = source.cost + dest.cost;
		Log.warn(`${this.name}/${this.pos} wants to steal from ${source.goal} at ${source.goal.pos} and deliver to ${dest.goal} at ${dest.goal.pos} (est ${totalCost} ticks / ${this.ticksToLive})`, 'Creep');

		this.pushStates([
			// ['RenewSelf', {}], // Life affects max pathfinding range, so renew before trying to head back out
			['Unload', null],
			['EvadeMove', { pos: dest.goal.pos, range: 1 }],
			['WithdrawAll', { target: source.goal.id, avoid: [RESOURCE_ENERGY] }],
			['EvadeMove', { pos: source.goal.pos, range: 1 }],
		]);
		const mult = 1.05;
		if (mult * (source.cost + dest.cost) > this.ticksToLive)
			this.pushState('RenewSelf', {});
	}
};

