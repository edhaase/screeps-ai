/**
 * role.war-miner.js
 *
 * Economy/Combat unit. Mines SK sources and minerals, prioritizes combat and SK spawning.
 * 
 * @todo heal nearby allies
 * @todo build own container
 * 
 * 2016-12-17: Now groups up on all non source-keepers, not just invaders.
 */
'use strict';
var ignoreCreeps = true;
import { RLD } from '/lib/util';
import { Log, LOG_LEVEL } from '/os/core/Log';

// Only need 6.66 work (7 work), but time spent fighting SK and healing
export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	minBody: RLD([9, WORK, 19, MOVE, 1, CARRY, 3, RANGED_ATTACK, 13, ATTACK, 4, HEAL, 1, MOVE]), // Cost: 4440
	init: function () {
		this.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });
	},
	/* eslint-disable consistent-return */
	run: function () {
		let { target, pos, cid, csid } = this.memory;
		let goal = Game.getObjectById(target);
		const container = Game.getObjectById(cid);
		const consite = Game.getObjectById(csid);
		const rpos = new RoomPosition(pos.x, pos.y, pos.roomName);

		// Kill threat first.
		this.say('act!');
		const threat = this.getTarget(
			({ room }) => room.intruders,
			(t) => this.pos.getRangeTo(t) <= 4 || t.owner.username !== 'Source Keeper',
			(candidates) => _.min(candidates, t => this.pos.getRangeTo(t))
		);
		if (threat) {
			this.say('threat!');
			// let threat = _.first(threats);
			// let threat = _.min(threats, 'hits');
			// let threat = _.min(threats, t => this.pos.getRangeTo(t));
			if (this.hasActiveBodypart(ATTACK)) {
				if (this.attack(threat) === ERR_NOT_IN_RANGE) {
					// this.moveTo(threat);
					this.intercept(threat);
					this.heal(this);
				}
			}

			if (this.hasActiveBodypart(RANGED_ATTACK)) {
				this.rangedAttack(threat);
				this.rangedMassAttack();
			}
			return;
		} else {
			// Heal self
			if (this.hits < this.hitsMax && this.hasActiveBodypart(HEAL)) {
				this.say('heal!');
				this.heal(this);
				if (this.pos.isNearTo(rpos))
					return;
			}

			if (this.pos.isEqualTo(rpos)) {
				// on arrival
				if (!this.memory.target) {
					const [mineral] = _.map(this.lookForNear(LOOK_MINERALS, true), LOOK_MINERALS);
					const [source] = _.map(this.lookForNear(LOOK_SOURCES, true), LOOK_SOURCES);
					const structures = this.room.lookForAt(LOOK_STRUCTURES, rpos);
					const sites = this.room.lookForAt(LOOK_CONSTRUCTION_SITES, rpos);

					target = source || mineral;
					if (!_.isEmpty(structures)) {
						const cont = _.find(structures, s => s.structureType === STRUCTURE_CONTAINER);
						if (cont)
							this.memory.cid = cont.id;
					}
					if (!_.isEmpty(sites)) {
						this.memory.csid = _.first(sites).id;
					}

					if (target) {
						this.say('found!');
						this.memory.target = target.id;
						goal = target;
					}
				} else {
					if (container && container.hitsMax - container.hits > this.getActiveBodyparts(WORK) * REPAIR_POWER)
						this.repair(container);
					if (consite && this.carry.energy > 40)
						this.build(consite);
				}

				this.say('harvest!');
				if (this.harvest(goal) === ERR_NOT_ENOUGH_RESOURCES) {
					if (goal.ticksToRegeneration && goal.ticksToRegeneration > this.ticksToLive)
						this.memory.role = 'recycle';
					Log.warn(`[Mining] ${this.name} exhausted source with ${goal.ticksToRegeneration} ticks left`);
				}
				// if(this.harvest(goal) === OK && goal instanceof Mineral)
				// this.defer(EXTRACTOR_COOLDOWN);
			} else {
				this.say('move!');
				this.moveTo(rpos, {
					reusePath: 5,
					ignoreCreeps: (this.memory.stuck < 3) ? ignoreCreeps : false,
					maxRooms: (this.pos.roomName === rpos.roomName) ? 1 : undefined
				});
			}
		}
	}
};