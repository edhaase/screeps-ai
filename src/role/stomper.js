/**
 * role.stomper.js - Crush enemy construction sites
 *
 */
'use strict';

const targeted = new Set();

module.exports = {
	boosts: [],
	minBody: [MOVE],
	init: function () {
		// Flee at 50% hp, or if we're about to lose our only heal part
		// this.memory.fleeAtHp = Math.max(this.hitsMax * 0.60, BODYPART_MAX_HITS * 1.50);
	},
	onCleanup: function (memory, name) {
		targeted.delete(memory.cid);
	},
	/* eslint-disable consistent-return */
	run: function () {
		// Only runs if we don't have a target.
		if (this.memory.cid) {
			targeted.delete(this.memory.cid);
			this.memory.cid = null;
		}

		const sites = _.compact(_.map(Game.rooms, r => r.find(FIND_HOSTILE_CONSTRUCTION_SITES)));
		const candidates = _.filter(sites, c => Player.status(c.owner.username) !== PLAYER_ALLY && !c.pos.hasRampart() && c.progress > 0 && _.get(c, 'room.controller.safeMode', 0) <= 0);
		if (!candidates || !candidates.length)
			return this.defer(5);
		const target = this.pos.getClosest(candidates, c => !target.has(c.id), 0) || _.sample(candidates);
		if (!target)
			return this.defer(5);
		this.memory.cid = target.id;
		targeted.add(target.id);
		this.pushState("EvadeMove", { pos: target.pos, range: 0 });
	}
};