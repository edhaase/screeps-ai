/**
 * type-ext-filler.js
 */
"use strict";

const STATE_GATHER = 'G';
const STATE_UNLOAD = 'U';
const STATE_DEFAULT = STATE_GATHER;

class CreepExtFiller extends Creep {
	/**
	 * Entry point of logic for this creep.
	 */
	runRole() {
		let { state = 'G' } = this.memory;

		const start = Game.cpu.getUsed();

		if (this.memory.stuck > 15)
			return this.wander();
		/* this.transition('I', () => true, STATE_GATHER);
		state = this.transition(STATE_GATHER, () => this.carryTotal >= this.carryCapacity, STATE_UNLOAD, () => this.clearTarget() );
		state = this.transition(STATE_UNLOAD, () => this.carryTotal <= 0, STATE_GATHER, () => this.clearTarget() );
		// state = this.getState();
		*/
		state = this.transitions([
			['I', () => true, STATE_GATHER],
			[STATE_GATHER, () => this.carryTotal >= this.carryCapacity, STATE_UNLOAD, () => this.clearTarget()],
			[STATE_UNLOAD, () => this.carryTotal <= 0, STATE_GATHER, () => this.clearTarget()]
		]);

		if (state === STATE_GATHER)
			this.gather();
		else if (state === STATE_UNLOAD)
			this.unload();
		else
			console.log(`ext-filler: Wrong state! ${state}`);
		// super.runRole();
		const used = Game.cpu.getUsed() - start;

		Volatile['type-ext-fill-' + state] = _.round((Volatile['type-ext-fill-' + state] || 0) + used, 3);
		Volatile['type-ext-fill'] = _.round((Volatile['type-ext-fill'] || 0) + used, 3);
		// console.log('ext-fill: used: ' + delta);
	}

	setState(state) {
		this.say(state);
		return super.setState(state);
	}

	/**
	 *
	 */
	gather() {
		const goal = this.getPickupSite();
		if (!goal) {
			this.say('No goal');
			if (this.carryTotal > 0)
				this.setState(STATE_UNLOAD);
			return this.defer(3);
		}
		// let status = this.withdraw(goal, RESOURCE_ENERGY);
		let status = OK;
		if (goal instanceof Resource)
			status = this.pickup(goal);
		else if (goal instanceof StructureTerminal)
			status = this.withdraw(goal, RESOURCE_ENERGY);
		else
			status = this.withdrawAny(goal);
		if (status === ERR_NOT_IN_RANGE)
			this.moveTo(goal);
		else if (status !== OK) {
			this.say('P! ' + status);
		}
	}

	getPickupSite() {
		const { terminal } = this.room;
		let goal = null;

		if (terminal) {
			// let sel = _(Game.creeps).filter('memory.target').map('memory.target').value();
			goal = this.getUniqueTarget(
				function ({ room }) {
					if (room.energyAvailable / room.energyCapacityAvailable < 0.5)
						return [...room.containers, ...room.links, room.storage, room.terminal, ...room.resources];
					else
						return [...room.containers, ...room.resources];
				},
				({ room }) => room.find(FIND_MY_CREEPS, { filter: c => c.getRole() === 'scav' && c.memory.tid }).map(c => c.memory.tid),
				t => Filter.canProvideEnergy(t, TERMINAL_MIN_ENERGY) || Filter.droppedResources(t) || ((t instanceof StructureContainer) && t.storedTotal > 100),
				// (c) => c.energy > 50 || (((c.stored && c.stored[RESOURCE_ENERGY] > 300) || Filter.droppedResources(c)) && !terminal.isFull()), // Validator
				// t => Filter.canProvideEnergy(t,300) || Filter.droppedResources(t),
				(candidates) => _.max(candidates, t => Math.min(this.getAmt(t), this.carryCapacityAvailable) / this.pos.getRangeTo(t.pos))
			);
		} else {
			// @todo candidate for early termination
			goal = this.getUniqueTarget(
				({ room }) => [...room.structures, ...room.resources],
				({ room }) => room.find(FIND_MY_CREEPS, { filter: c => c.getRole() === 'scav' && c.memory.tid }).map(c => c.memory.tid),
				(s) => {
					if(this.room.energyPct > 0.5 && (s.structureType === STRUCTURE_LINK || s.structureType === STRUCTURE_STORAGE))
						return false;
					return Filter.canProvideEnergy(s);
				},
				// (c) => c.store[RESOURCE_ENERGY] > 300, // Validator
				(candidates) => _.max(candidates, t => Math.min(this.getAmt(t), this.carryCapacityAvailable) / this.pos.getRangeTo(t.pos))
			);
		}

		/* if(!goal) {
			if(terminal && storage)
				goal = _.max([terminal, storage], 'store.energy');
			else
				goal = terminal || storage;
			if(goal)
				this.setTarget(goal);
		} */

		/* let {target} = this.memory;
		let goal = Game.getObjectById(target);
		if(goal && this.getAmt(goal) < 0.10)
			goal = null;
		if(!goal) {		
			let sel = _(Game.creeps).filter('memory.target').map('memory.target').value();
			if(this.room.terminal == undefined)
				goal = _.find(this.room.containers, c => c.store[RESOURCE_ENERGY] > 300 && sel.indexOf(c.id) === -1);
			else
				goal = _.find(this.room.containers, c => c.storedTotal > 300 && sel.indexOf(c.id) === -1);
			// if(!_.isEmpty(this.room.containers))
			//	goal = _.max(this.room.containers, c => c.store[RESOURCE_ENERGY})
		}
		if(!goal || this.getAmt(goal) < 0.25) { // 
			// let targets = this.room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LINK || s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_TERMINAL});
			let targets = this.room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_TERMINAL});
			goal = _.max(targets, t => Math.min(this.getAmt(t), this.carryCapacityAvailable) / this.pos.getRangeTo(t.pos) );
			if(goal === Infinity)
				return null;
		}
		this.memory.target = goal.id; */
		return goal;
	}

	/**
	 * Return energy storage
	 */
	getAmt(thing) {
		if (typeof thing === 'string')
			thing = Game.getObjectById(thing);
		/* if(thing.store !== undefined)
			return thing.storedTotal;
		else if(thing.amount)
			return thing.amount;
		else
			return thing.energy / thing.energyCapacity; */
		return thing.storedTotal || thing.amount || thing.energy;
	}

	getAmtPct(thing) {
		if (typeof thing === 'string')
			thing = Game.getObjectById(thing);
		if (thing.store !== undefined)
			return thing.storedTotal / thing.storeCapacity;
		// return (thing.store[RESOURCE_ENERGY] || 0) / thing.storeCapacity;
		else if (thing.amount)
			return 1.0;
		else
			return thing.energy / thing.energyCapacity;
	}

	amtInRange(thing) {
		const amt = this.getAmtPct(thing);
		return (amt > 0 && amt < 1);
	}

	full(thing) {
		if (thing instanceof StructureController)
			return false;
		return this.getAmtPct(thing) >= 1;
	}

	/**
	 * 
	 */
	unload() {
		var { terminal, storage, controller } = this.room;
		let goal = this.getDropoff();
		if (!goal && this.carry[RESOURCE_ENERGY] > 0)
			goal = terminal || storage || controller; // 1 work part and high carry means ~800 ticks of sitting around upgrading.
		// goal = this.room.controller;
		if (!goal) {
			this.say('No goal');
			//if( this.moveTo(this.room.storage, {range: 2, ignoreCreeps: true}) == ERR_NO_PATH )
			this.defer(3);
			if (this.carry[RESOURCE_ENERGY] / this.carryCapacity < 0.25)
				this.memory.state = 'G';
			return;
		}
		// End loop, unload resources to goal
		let status = OK;
		if (goal instanceof StructureTerminal)
			status = this.transferAny(goal); // , RESOURCE_ENERGY);
		else
			status = this.transfer(goal, RESOURCE_ENERGY);

		if (status === ERR_NOT_IN_RANGE)
			this.moveTo(goal);
		else if (status === ERR_FULL) {
			this.say('full!');
			this.clearTarget();
		} else if (status !== OK)
			Log.error(`${this.name} ext-fill: status: ${status} on ${goal} at ${this.pos}`, 'Creep');
	}

	getDropoff() {
		let goal = null;
		if (this.room.controller.isEmergencyModeActive() && !this.room.controller.upgradeBlocked && this.carry[RESOURCE_ENERGY] > 0)
			return this.room.controller;
		if (this.isCarryingNonEnergyResource()) {
			goal = this.room.terminal;
		} else {
			/* goal = this.getUniqueTarget(
				({room,pos}) => room.structures, // Find all available targets
				({room,pos}) => room.find(FIND_MY_CREEPS, {filter: c => c.getRole() == 'scav' && c.memory.tid}).map(c => c.memory.tid),
				(s) => s.energy != undefined && s.energyPct < 1 && s.structureType !== STRUCTURE_LINK,
				(candidates) => _.min(candidates, s => (1+s.energyPct) * s.pos.getRangeTo(this.pos) )
			); */

			goal = this.getUniqueTarget(
				// Construction of the candidate list runs seldomly. Let it do the expensive stuff.
				({ room }) => _.filter([...room.structuresMy, ...room.creeps], function (sel) {
					if (Filter.canReceiveEnergy(sel) <= 0)
						return false;
					if (sel instanceof Creep) {
						return ['upgrader', 'builder', 'repair'].includes(sel.getRole());
					} else if (sel instanceof StructureLink)
						return false;
					if (sel.store != null)
						return false;
					return true;
				}), // Find all available targets
				({ room }) => room.find(FIND_MY_CREEPS, { filter: c => c.getRole() === 'scav' && c.memory.tid }).map(c => c.memory.tid),
				// (c) => Filter.canReceiveEnergy(c) && c.pos.roomName == this.pos.roomName, // currently don't fill stores this way
				(c) => Filter.canReceiveEnergy(c) && c.pos.roomName === this.pos.roomName && c.id !== this.memory.avoid, // currently don't fill stores this way
				(candidates) => _.min(candidates, s => (1 + Filter.canReceiveEnergy(s)) * s.pos.getRangeTo(this.pos))
			);

			if (!goal) {
				const { storage, terminal, controller } = this.room;
				if (terminal && terminal.my && (terminal.store[RESOURCE_ENERGY] < TERMINAL_MIN_ENERGY*2 || (storage && storage.stock >= 1) ) )
					goal = terminal;
				else if (storage && storage.my && (storage.store[RESOURCE_ENERGY] / storage.storeCapacity < 0.9))
					goal = storage;
				else
					goal = controller;
				this.setTarget(goal);
			}

		}
		return goal;
	}

	withdraw(target, amt) {
		const status = super.withdraw.apply(this, arguments);
		if (status === OK)
			this.memory.avoid = target.id;
		return status;
	}

	pickup() {
		const status = super.pickup.apply(this, arguments);
		if (status === OK)
			this.memory.avoid = undefined;
		return status;
	}

	/**
	 * Override moveTo With new custom properties
	 */
	moveTo(goal, opts = { range: 1, reusePath: 7, maxRooms: 1, ignoreCreeps: true }) {
		opts.ignoreRoads = (this.carryTotal <= (this.carryCapacity / 2));
		// opts.maxCost = this.ticksToLive;
		if (this.memory.stuck > 3)
			opts.ignoreCreeps = false;
		opts.costCallback = r => LOGISTICS_MATRIX[r];
		if (goal instanceof StructureController)
			opts.range = 3;
		opts.maxRooms = 1;
		var status = super.moveTo(goal, opts);
		// if(status !== OK && status !== ERR_TIRED)
		//	console.log('status: ' + status + ' at ' + this.pos);
		return status;
	}

	toString() {
		return `[creep extfill ${this.name}]`;
	}
}

module.exports = CreepExtFiller;