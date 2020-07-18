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
import { TERMINAL_MAINTAIN_RESERVE } from '/proto/structure/terminal';
import { ICON_SLEEP } from '/lib/icons';
import { Log, LOG_LEVEL } from '/os/core/Log';

// @todo fiddle with this
const MINIMUM_TIME_TO_LOAD = 15; // 15 ticks to load
const AMOUNT_TO_LOAD = TERMINAL_MAINTAIN_RESERVE;
const MINIMUM_NEEDED_TO_LOAD = 100;
// LAB_MINERAL_CAPACITY: 3000,
// LAB_ENERGY_CAPACITY: 2000,
// LAB_BOOST_ENERGY: 20,
// LAB_BOOST_MINERAL: 30,



/**
 * 
 */

/**
 * Only spawns if have a terminal with compounds and labs with energy
 * Not critical to economy, but damn useful if available
 */
export default {
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
		const { storage, terminal } = this.room;

		/**
		 * If we don't have a terminal we can't do _anything_.
		 */
		if (!terminal)
			return this.setRole('recycle');
		else if (this.carryTotal > 0) { // If our hands are full, unload
			const dropoff = terminal.isActive() ? terminal : this.pos.findClosestTerminal();
			if (dropoff)
				return this.pushState('Transfer', { res: _.findKey(this.carry), dst: dropoff.id });
			return this.say('STUCK!');
		}

		/**
		 * Start by cleaning up the room.
		 */
		const resource = this.pos.findClosestByRange(this.room.resources, { filter: r => r.resourceType !== RESOURCE_ENERGY });
		if (resource) {
			return this.pushState('Transfer', { src: resource.id, dst: terminal.id });
		}
		const tombstone = this.pos.findClosestByRange(this.room.tombstones, { filter: t => _.findKey(t.store, (a, k) => a > 0 && k !== RESOURCE_ENERGY) });
		if (tombstone) {
			return this.pushState('WithdrawAll', { target: tombstone.id, avoid: [RESOURCE_ENERGY] });
		}
		const container = this.pos.findClosestByRange(this.room.structuresByType[STRUCTURE_CONTAINER], { filter: t => _.findKey(t.store, (a, k) => a > 0 && k !== RESOURCE_ENERGY) });
		if (container) {
			return this.pushState('WithdrawAll', { target: container.id, avoid: [RESOURCE_ENERGY] });
		}
		if (storage && _.findKey(storage.store, (v, k) => k !== RESOURCE_ENERGY))
			return this.pushState('WithdrawAll', { target: storage.id, avoid: [RESOURCE_ENERGY] });

		/**
		 * Then handle compounds
		 */
		const spawns = this.room.find(FIND_MY_SPAWNS);
		const labs = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB && s.isActive() });
		const activeSpawns = _.sortBy(_.filter(spawns, s => s.spawning), 'remainingTime');

		// @todo look at spawn queue as well
		var current = [];
		for (const { spawning } of activeSpawns) {
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
			Log.debug(`${this.name}/${this.pos} wants to support creep ${name} in under ${remainingTime} with ${demand}`, 'Scientist');
		}
		let amt;
		const orderedLabs = (current && current.length) ? _.sortByAll(labs, [l => l.pos.getRangeTo(terminal), 'id']) : [];
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
			this.pushState('Defer', { ticks: 5 }); // After we've loaded everything, take a nap.
			this.pushState('Transfer', { src: terminal.id, dst: lab.id, res: compound, amt }, false);
			if (lab.mineralType && lab.mineralType !== compound) {
				this.pushState('Transfer', { src: lab.id, dst: terminal.id, amt: lab.mineralAmount, res: lab.mineralType }, false);
				Log.info(`${this.name}/${this.pos} Unloading ${lab.mineralAmount} ${lab.mineralType} from ${lab} to ${terminal}`, 'Scientist');
			}
			return;
		}

		//  @todo there's still a window between when a boosting creep has finished spawning and when
		// we can actually swap out minerals. So we still need to trigger some sort of wait.
		if (current && current.length) {
			this.say('WAIT!');
			return this.defer(5); // We have labs assigned to boosting, so let's avoid breaking that for now.
		}

		/**
		 * If we don't have any creeps to support with boosting, break down resources
		 */
		const BREAKDOWN_RESOURCES = ['GO', 'KO', 'ZH'];
		for (const bdr of BREAKDOWN_RESOURCES) {
			if (terminal.store.getUsedCapacity(bdr) >= TERMINAL_MAINTAIN_RESERVE + LAB_REACTION_AMOUNT) {
				// if (terminal.store.getUsedCapacity('GO') >= LAB_REACTION_AMOUNT * REACT_TIMES) { // unless ghodium becomes worth more than GO..
				const src = terminal.pos.findClosestByRange(labs, { filter: s => (s.cooldown || 0) <= LAB_REACTION_AMOUNT && s.isReactionCapable() });
				if (src) {
					const [sink1, sink2] = src.getNeighbors();
					Log.debug(`${this.name}/${this.pos} wants to break down ${bdr}`, 'Scientist');
					this.say('<<<');
					return this.pushState('Breakdown', { res: bdr, src: src.id, sink1: sink1.id, sink2: sink2.id });
				}
				break;
			}
		}

		/**
		 * If we get here, we probably haven't pushed any states and don't have anything to do.
		 */
		Log.info(`${this.name}/${this.pos} Nothing to do`, 'Scientist');
		this.say(ICON_SLEEP);
		// Idle conditions			
		if (labs && labs.length && (Math.random() > 0.90 || this.memory.stuck > 15)) {
			return this.pushState("MoveTo", { pos: _.sample(labs).pos, range: 1 });
		} else if (spawns && spawns.length && (Math.random() > (this.ticksToLive / this.memory.minRenew)))
			return this.pushState("MoveTo", { pos: _.sample(spawns).pos, range: 1 });
		this.defer(5);
	}
};