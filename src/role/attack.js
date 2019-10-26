/**
 * role.attacker.js - Pretty much identical to the bulldozer, with some additional checks.
 */
'use strict';

module.exports = {
	//  boosts: ['ZH', 'ZH2O', 'XZH2O'],
	priority: function () {
		// (Optional)
	},
	body: function ({room}) {
		return Arr.repeat([ATTACK, MOVE], room.energyAvailable);
	},
	init: function () {
		this.pushState("TowerDrain", { dest: this.memory.dest });
		this.pushState("MoveToRoom", { room: this.memory.dest, enter: false });
	},
	/* eslint-disable consistent-return */
	run: function () {
		if (this.pos.roomName !== this.memory.dest)
			return this.pushState('MoveToRoom', { room: this.memory.dest, enter: true });
		if (this.room.controller.safeMode && this.room.controller.safeMode > this.ticksToLive)
			return this.setRole('recycle');

		const { avoidRamparts = true } = this.memory;
		const target = this.getTarget(
			({ room }) => room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType !== STRUCTURE_CONTROLLER && s.structureType !== STRUCTURE_RAMPART }),
			(s) => Filter.unauthorizedHostile(s) && (!avoidRamparts || !s.pos.hasRampart(r => !r.isPublic)),
			(candidates) => this.pos.findClosestByPath(candidates)
		);

		if (!target) {
			if (avoidRamparts) {
				this.memory.avoidRamparts = false;
				return;
			} else {
				this.setRole('recycle');
				// this.memory.avoidRamparts = true;
				// return this.pushState('Breach', this.pos.roomName);
			}
		}

		// RMA doesn't block anything
		if (this.hasActiveBodypart(RANGED_ATTACK))
			this.rangedMassAttack();
		const range = this.pos.getRangeTo(target);
		if (range > 1) {
			this.moveTo(target);
			this.heal(this);
		} else if (this.hasActiveBodypart(WORK) && CONSTRUCTION_COST[target.structureType]) {
			this.dismantle(target);
		} else if (this.hasActiveBodypart(ATTACK))
			this.attack(target);
		else
			this.heal(this);
	}
};