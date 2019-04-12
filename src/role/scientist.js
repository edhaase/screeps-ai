/**
 * role.scientist - Transfers resources to and from labs
 * 
 * example: .submit({memory:{role:'scientist}})
 * 
 * @todo add to expense?
 */
'use strict';

/* global Log, RENEW_TICKS */
/* global RECIPES, BOOST_PARTS, REACTION_TIME */
/* glboal TERMINAL_MAINTAIN_RESERVE */
/* eslint-disable consistent-return */

// @todo fiddle with this
const MINIMUM_TIME_TO_LOAD = 15; // 15 ticks to load
const AMOUNT_TO_LOAD = TERMINAL_MAINTAIN_RESERVE;
const MINIMUM_NEEDED_TO_LOAD = 100;
// LAB_MINERAL_CAPACITY: 3000,
// LAB_ENERGY_CAPACITY: 2000,
// LAB_BOOST_ENERGY: 20,
// LAB_BOOST_MINERAL: 30,

/**
 * Only spawns if have a terminal with compounds and labs with energy
 * Not critical to economy, but damn useful if available
 */
module.exports = {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	minBody: [MOVE, CARRY],
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		this.memory.minRenew = CREEP_LIFE_TIME - RENEW_TICKS(this.body);
	},
	run: function () {
		const { terminal } = this.room;
		const labs = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB });
		const orderedLabs = _.sortByAll(labs, [l => l.pos.getRangeTo(terminal), 'id']);
		const spawns = this.room.find(FIND_MY_SPAWNS);
		const active = _.sortBy(_.filter(spawns, s => s.spawning), 'remainingTime');

		if (this.carryTotal > 0 && terminal) {
			const resource = _.findKey(this.carry);
			return this.transferOrMove(terminal, resource);
		}

		// Cleanup
		const resource = this.pos.findClosestByRange(this.room.resources, { filter: r => r.resourceType !== RESOURCE_ENERGY });
		if (resource) {
			return this.pushState('Transfer', { src: resource.id, dst: terminal.id });
		}
		const tombstone = this.pos.findClosestByRange(this.room.tombstones, { filter: t => _.findKey(t.store, (a, k) => a > 0 && k !== RESOURCE_ENERGY) });
		if (tombstone) {
			return this.pushState('Transfer', { src: tombstone.id, dst: terminal.id, res: _.findKey(tombstone.store, (a, k) => a > 0 && k !== RESOURCE_ENERGY) });
		}

		if (this.carryTotal > 0) {
			this.pushState('Transfer', { res: _.findKey(this.carry), dst: terminal.id });
		}

		// Idle conditions
		if (!terminal || !labs || !labs.length)
			return this.setRole('recycle');
		if (Math.random() > 0.90 || this.memory.stuck > 15) {
			return this.pushState("MoveTo", { pos: _.sample(labs).pos, range: 1 });
		} else if (Math.random() > (this.ticksToLive / this.memory.minRenew))
			return this.pushState("MoveTo", { pos: _.sample(spawns).pos, range: 1 });

		// If still idle, find work, push states.
		if (!active || !active.length) {
			this.say('Wait!');
			return this.defer(5);
		}

		// @todo look at spawn queue as well
		var current = [];
		for (const { spawning } of active) {
			const { name, remainingTime } = spawning;
			if (remainingTime < MINIMUM_TIME_TO_LOAD || current.length >= labs.length)
				continue;
			const creep = Game.creeps[name];
			const boosts = _.sortByOrder(creep.module.boosts, b => REACTION_TIME[b], 'desc');
			if (!boosts || !boosts.length)
				continue;
			const demand = _.unique(boosts, false, b => terminal.store[b] >= 750 && BOOST_PARTS[b]);
			for (const res of demand) {
				current.push(res);
				if (current.length >= labs.length)
					break;
			}
			Log.debug(`${this.name} wants to support creep ${name} in under ${remainingTime} with ${demand}`, 'Scientist');
		}
		if (!current || !current.length) {
			this.say('Wait!');
			return this.defer(5);
		}
		// Log.warn(`${this.name} wants to load ${current} compounds in ${orderedLabs}!`);
		// We're all ready to go! Start pushing states for next tick!
		// @todo loop backwards since this is a push?
		// @todo better calc amount
		let amt;
		for (var i = 0; i < current.length; i++) {
			const lab = orderedLabs[i];
			const compound = current[i];
			amt = AMOUNT_TO_LOAD;
			if (lab.mineralType && lab.mineralType === compound)
				amt -= lab.mineralAmount;
			if (amt <= 0)
				continue;
			if ((terminal.store[compound] || 0) < MINIMUM_NEEDED_TO_LOAD)
				continue;
			Log.warn(`${this.name}/${this.pos} Loading ${amt} ${compound} to ${lab} (${lab.mineralAmount}) on tick ${Game.time}`, 'Scientist');
			this.pushState('Transfer', { src: terminal.id, dst: lab.id, res: compound, amt }, false);
			if (lab.mineralType && lab.mineralType !== compound) {
				this.pushState('Transfer', { src: lab.id, dst: terminal.id, amt: lab.mineralAmount, res: lab.mineralType }, false);
				Log.info(`${this.name}/${this.pos} Unloading ${lab.mineralAmount} ${lab.mineralType} from ${lab} to ${terminal}`, 'Scientist');
			}
			return;
		}
		Log.info(`${this.name}/${this.pos} Nothing we can load`, 'Scientist');
		this.defer(5);
	}
};