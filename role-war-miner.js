/**
 * role-war-miner
 *
 * Economy/Combat unit. Mines SK sources and minerals, prioritizes combat and SK spawning.
 * @todo: heal nearby allies
 * @todo: builder own container
 * 2016-12-17: Now groups up on all non source-keepers, not just invaders.
 */
"use strict";
var ignoreCreeps = true;

// Only need 6.66 work (7 work), but time spent fighting SK and healing
// Util.RLD([10,WORK,20,MOVE,15,ATTACK,5,HEAL])
// Game.spawns['E54S47_1'].enqueue(Util.RLD([10,WORK,20,MOVE,15,ATTACK,5,HEAL]), null, {role:'war-miner',target:'579fab9f43bc207b0c99a339',pos:new RoomPosition(45,45,'E54S46')})
// Game.spawns['E54S47_1'].enqueue(Util.RLD([10,WORK,20,MOVE,15,ATTACK,5,HEAL]), null, {role:'war-miner',target:'579faa2c0700be0674d308db',pos:new RoomPosition(33,5,'E54S46')})
module.exports = function (creep) {
	let { target, pos, cid, csid } = creep.memory;
	let goal = Game.getObjectById(target);
	let container = Game.getObjectById(cid);
	let consite = Game.getObjectById(csid);
	let rpos = _.create(RoomPosition.prototype, pos);

	if (creep.cache.notify == undefined) {
		creep.notifyWhenAttacked(false);
		creep.cache.notify = true;
	}


	// Kill threat first.
	creep.say('act!');
	// let threats = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5, {filter: Filter.unauthorizedHostile});
	// let threats = creep.room.hostiles;
	// threats = _.filter(threats, t => creep.pos.getRangeTo(t) <= 4 || t.owner.username !== 'Source Keeper' );
	// if(threats && !_.isEmpty(threats)) {
	let threat = this.getTarget(
		({ room }) => room.hostiles,
		(t) => creep.pos.getRangeTo(t) <= 4 || t.owner.username !== 'Source Keeper',
		(candidates) => _.min(candidates, t => creep.pos.getRangeTo(t))
	);
	if (threat) {
		creep.say('threat!');
		// let threat = _.first(threats);
		// let threat = _.min(threats, 'hits');
		// let threat = _.min(threats, t => creep.pos.getRangeTo(t));
		if (creep.hasActiveBodypart(ATTACK)) {
			if (creep.attack(threat) === ERR_NOT_IN_RANGE) {
				// creep.moveTo(threat);
				creep.intercept(threat);
				creep.heal(creep);
			}
		}

		if (creep.hasActiveBodypart(RANGED_ATTACK)) {
			if (threats.length < 3)
				creep.rangedAttack(threat);
			else
				creep.rangedMassAttack();
		}
		return;
	} else {
		// Heal self
		if (creep.hits < creep.hitsMax && creep.hasActiveBodypart(HEAL)) {
			creep.say('heal!');
			creep.heal(creep);
			if (creep.pos.isNearTo(rpos))
				return;
		}

		if (creep.pos.isEqualTo(rpos)) {
			// on arrival
			if (!creep.memory.target) {
				let minerals = _.map(creep.lookForNear(LOOK_MINERALS, true), LOOK_MINERALS);
				let sources = _.map(creep.lookForNear(LOOK_SOURCES, true), LOOK_SOURCES);
				let structures = creep.room.lookForAt(LOOK_STRUCTURES, rpos);
				let sites = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES, rpos);

				if (!_.isEmpty(minerals))
					target = minerals[0];
				if (!_.isEmpty(sources))
					target = sources[0];
				if (!_.isEmpty(structures)) {
					// _.each(structures, s => console.log(ex(s)));
					let cont = _.find(structures, s => s.structureType === STRUCTURE_CONTAINER);
					if (cont)
						creep.memory.cid = cont.id;
				}
				if (!_.isEmpty(sites)) {
					creep.memory.csid = _.first(sites).id;
				}

				if (target) {
					creep.say('found!');
					console.log('Creep ' + creep.name + ' found ' + target);
					creep.memory.target = target.id;
					goal = target;
				}
			} else {
				if (container && container.hitsMax - container.hits > creep.getActiveBodyparts(WORK) * REPAIR_POWER)
					creep.repair(container);
				if (consite && creep.carry.energy > 40)
					creep.build(consite);
			}

			creep.say('harvest!');
			if (creep.harvest(goal) === ERR_NOT_ENOUGH_RESOURCES) {
				if (goal.ticksToRegeneration && goal.ticksToRegeneration > creep.ticksToLive)
					creep.memory.role = 'recycle';
				Log.warn('[Mining] ' + this.name + ' exhausted source with ' + goal.ticksToRegeneration + ' ticks left');
			}
			// if(creep.harvest(goal) === OK && goal instanceof Mineral)
			// creep.defer(EXTRACTOR_COOLDOWN);
		} else {
			creep.say('move!');
			creep.moveTo(rpos, {
				reusePath: 5,
				ignoreCreeps: (creep.memory.stuck < 3) ? ignoreCreeps : false,
				maxRooms: (this.pos.roomName == rpos.roomName) ? 1 : 16
			});
		}
	}
};