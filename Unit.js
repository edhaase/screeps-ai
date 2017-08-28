/**
 * Unit.js
 *
 * Reoccuring unit management
 */
"use strict";

const Arr = require('Arr');

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
// Unit.Body.from([WORK,CARRY,MOVE]).sort() -- confirmed to work
class Body extends Array {
	/** override push to limit size */
	push(part) {
		if (this.length >= MAX_CREEP_SIZE)
			throw new Error(`Creep body is limited to ${MAX_CREEP_SIZE} parts`);
		return super.push(part);
	}

	/** override fill to limit size */
	fill(value, start = 0, end = this.length) {
		return super.fill(value, start, Math.min(MAX_CREEP_SIZE, end));
	}

	/** override unshift to limit size */
	unshift(...args) {
		if (args.length + this.length > MAX_CREEP_SIZE)
			throw new Error(`Creep body is limited to ${MAX_CREEP_SIZE} parts`);
		return super.unshift.apply(this, args);
	}

	concat(...args) {
		return super.concat.apply(this, args);
	}

	cost() {
		return _.sum(this, p => BODYPART_COST[p]);
	}

	ticks() {
		return this.length * CREEP_SPAWN_TIME;
	}

	getCounts() {
		return _.countBy(this);
	}

	sort() {
		return _.sortBy(this, p => _.indexOf([TOUGH, MOVE, WORK, CARRY, ATTACK, RANGED_ATTACK, HEAL, CLAIM], p));
	}

}

global.Body = Body;

module.exports = {
	Body: Body,

	/**
	 * Bulk role change
	 */
	bulkRoleChange: function (from, to) {
		return _.each(_.filter(Game.creeps, 'memory.role', from), c => c.memory.role = to);
	},

	listAges: () => _.map(Game.creeps, c => Game.time - c.memory.born),
	oldestCreep: () => _.max(Game.creeps, c => Game.time - c.memory.born),

	/**
	 * Sort a creep body so that 1 of each part (except tough)
	 * ends up on the end, then sorts as normal. 
	 */
	tailSort(body) {
		var first = {};
		var order = [TOUGH, MOVE, WORK, CARRY, RANGED_ATTACK, ATTACK, CLAIM, HEAL];
		return _.sortBy(body, function (part) {
			if (part !== TOUGH && first[part] === undefined) {
				first[part] = false;
				return 1000 - order.indexOf(part); // Arbritarly large number.
			} else {
				return order.indexOf(part);
			}
		});
	},

	/**
     * Sums up the part cost to build a thing
     */
	cost: _.memoize(function cost(parts) {
		return _.sum(parts, part => BODYPART_COST[part]);
	}),

	livingCost: c => _.sum(c.body, part => BODYPART_COST[part.type]),

	sort: body => _.sortBy(body, p => _.indexOf([TOUGH, MOVE, WORK, CARRY, ATTACK, RANGED_ATTACK, HEAL, CLAIM], p)),

	shuffle: function (body) {
		if (body == null)
			return undefined;
		return _(body)
			.sortBy(function (part) {
				if (part === TOUGH)
					return 0;
				else if (part === HEAL)
					return BODYPARTS_ALL.length;
				else
					return _.random(1, BODYPARTS_ALL.length - 1);
			})
			.value();
	},

	/**
	 * Repeat a part cost until we hit max cost, or reach 50 parts.
	 */
	repeat: function (arr, max) {
		console.log('Unit.repeat is deprecated');
		return Arr.repeat(arr, max);
	},

	/**
	 * Biggest we can! Limit to 15 work parts
	 * requestUpgrader(firstSpawn,1,5,49)
	 */
	requestUpgrader: function (spawn, home, priority = 3, max = 2500) {
		var body = [];
		// energy use is  active work * UPGRADE_CONTROLLER_POWER, so 11 work parts is 11 ept, over half a room's normal production

		if (spawn.room.controller.level <= 2) {
			body = [CARRY, MOVE, WORK, WORK];
		} else {
			if (_.get(spawn.room, 'storage.store.energy', 0) < 100000) {
				max = Math.min(BODYPART_COST[WORK] * 10, max); // Less than 20 ept.
			}
			if (spawn.room.controller.level === MAX_ROOM_LEVEL)
				max = UNIT_COST([MOVE, MOVE, MOVE, CARRY]) + BODYPART_COST[WORK] * CONTROLLER_MAX_UPGRADE_PER_TICK * UPGRADE_CONTROLLER_POWER;
			// Ignore top 20% of spawn energy (might be in use by renewels)
			var avail = Math.clamp(250, spawn.room.energyCapacityAvailable - (SPAWN_ENERGY_CAPACITY * 0.20), max);
			var count = Math.floor((avail - 300) / BODYPART_COST[WORK]);
			let ccarry = 1;
			if (count > 5) {
				ccarry += 2;
				count -= 2;
			}
			body = Util.RLD([ccarry, CARRY, 1, WORK, count, WORK, 3, MOVE]);
		}
		return spawn.enqueue(body, null, { home: home, role: 'upgrader' }, priority);
		//spawn.enqueue(body, null, {role:'upgrader'}, -1, 0, 1);
	},

	requestWarMiner: function (spawn, memory) {
		if (!memory)
			throw new Error('argument 2 memory cannot be null');
		// return spawn.enqueue( Util.RLD([9,WORK,20,MOVE,1,CARRY,15,ATTACK,5,HEAL]), // Cost: 4400
		// return spawn.enqueue( Util.RLD([9,WORK,20,MOVE,1,CARRY,2,RANGED_ATTACK,14,ATTACK,4,HEAL]), // Cost: 4370
		return spawn.enqueue(Util.RLD([9, WORK, 19, MOVE, 1, CARRY, 3, RANGED_ATTACK, 13, ATTACK, 4, HEAL, 1, MOVE]), // Cost: 4440
			null,
			memory, 1, 1, 1, 200);
	},

	requestMicroBuilder: function (spawn, roomName) {
		// WCM creep only generates fatigue when carrying resource.
		// return trip is fine.
		return spawn.enqueue([WORK, CARRY, MOVE, MOVE], null, { home: roomName, role: 'builder' });
		// return this.requestBuilder(spawn, {body:[WORK,CARRY,MOVE,MOVE]} )
	},

	/**
	 * Biggest we can!
	 * WARNING: _5_ energy per tick per part, not 1.
	 */
	requestBuilder: function (spawn, { elimit = 20, home, body, num = 1, priority = 0, expire = DEFAULT_SPAWN_JOB_EXPIRE } = {}) {
		// let avail = Math.clamp(300, spawn.room.energyCapacityAvailable, 2000);
		const partLimit = Math.floor(elimit / BUILD_POWER);
		const avail = Math.max(SPAWN_ENERGY_START, spawn.room.energyCapacityAvailable);
		const pattern = [MOVE, MOVE, MOVE, WORK, WORK, CARRY];
		const cost = UNIT_COST(pattern);
		const al = Math.min(Math.floor(cost * (partLimit / 2)), avail);
		// console.log(`Pattern cost: ${cost}, avail: ${avail}, limit: ${al}`);
		if (body == null)
			body = this.repeat(pattern, al); // 400 energy gets me 2 work parts.
		if (_.isEmpty(body)) {
			body = [WORK, CARRY, MOVE, MOVE];
		}
		return spawn.enqueue(body, null, { home: home, role: 'builder' }, priority, 0, num, expire);
	},

	requestBulldozer: function (spawn, roomName) {
		const body = [WORK, WORK, MOVE, MOVE];
		return spawn.enqueue(body, null, { role: 'bulldozer', site: roomName }, 10);
	},

	requestDualMiner: function (spawn, workRoom, totalCapacity, steps, expire = 50) {
		const size = Math.ceil(totalCapacity / HARVEST_POWER / (ENERGY_REGEN_TIME - steps)) + 1; // +2 margin of error
		Log.info(`Dual mining op has ${totalCapacity} total capacity`, 'Controller');
		Log.info(`Dual mining op wants ${size} harvest parts`, 'Controller');

		const body = Util.RLD([
			size, WORK,
			1, CARRY,
			Math.ceil((1 + size) / 2), MOVE
		]);
		if (body.length > 50) {
			Log.warn('[Controller] Body of creep would be too big to build');
			return false;
		}
		const cost = UNIT_COST(body);
		if (spawn.room.energyCapacityAvailable < cost) {
			Log.warn('[Controller] Body of creep is too expensive for the closest spawn');
			return false;
		}
		var prio = (spawn.pos.roomName === workRoom) ? 50 : 10;
		return spawn.enqueue(body, null, { role: 'dualminer', site: workRoom }, prio, 0, 1, expire);
	},

	/**
	 * Biggest we can!
	 */
	requestRepair: function (spawn, home, maxAvail = Infinity, prio = 10) {
		const avail = Math.clamp(400, spawn.room.energyCapacityAvailable, maxAvail);
		// var body = this.repeat([WORK,CARRY,MOVE,MOVE], avail);
		// var body = this.repeat([WORK,WORK,CARRY,MOVE,MOVE,MOVE], avail);
		var body = this.repeat([MOVE, MOVE, MOVE, WORK, WORK, CARRY], avail);
		return spawn.enqueue(body, null, { home: home, role: 'repair' }, prio);
	},

	requestHapgrader: function (spawn, site, expire = DEFAULT_SPAWN_JOB_EXPIRE) {
		return spawn.enqueue(
			[WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE],
			null, { role: 'hapgrader', site: site }, 10, 0, 1, expire
		);
	},

	requestScav: function (spawn, home = null, canRenew = true, priority = 50, hasRoad = true) {
		var memory = {
			role: 'scav',
			type: 'ext-filler',
			eca: spawn.room.energyCapacityAvailable
		};
		if (canRenew === false)
			memory.bits = BIT_CREEP_DISABLE_RENEW;

		memory.home = home || spawn.pos.roomName;

		// let capacity = spawn.room.energyCapacityAvailable;
		// reduce max size so we don't need a "full" room, which seems rare
		let capacity = Math.ceil(spawn.room.energyCapacityAvailable * 0.75);
		if (home !== spawn.pos.roomName)
			capacity /= 2; // Smaller scavs in remote rooms.
		// var body, avail = Math.clamp(250, capacity, 1500) - BODYPART_COST[WORK];
		var body, avail = Math.clamp(250, capacity, 1500) - UNIT_COST([WORK, MOVE]);
		if (hasRoad)
			body = this.repeat([CARRY, CARRY, MOVE], avail);
		else
			body = this.repeat([CARRY, MOVE], avail);
		body.unshift(WORK);
		body.unshift(MOVE);
		if (!body || body.length <= 3) {
			console.log("Unable to build scav");
		} else {
			// console.log("Scav body: " + JSON.stringify(body) + " ==> " + UNIT_COST(body));
			// enqueue(body, name=null, memory, priority=1, delay=0, count=1, expire=Infinity)			
			spawn.enqueue(body, null, memory, priority, 0, 1, DEFAULT_SPAWN_JOB_EXPIRE);
		}
	},

	requestClaimer: function (spawn) {
		let body = [CLAIM, MOVE];
		let cost = UNIT_COST(body);
		while (cost < spawn.room.energyCapacityAvailable && body.length < 6) {
			body.push(MOVE);
			cost += BODYPART_COST[MOVE];
		}
		return spawn.enqueue(body, null, { role: 'claimer' });
	},

	requestScout: function (spawn, memory = { role: 'scout' }) {
		return spawn.enqueue([MOVE], null, memory);
	},

	requestDefender: function (spawn, count = 1, roomName, prio = 75) {
		// let body = this.repeat([TOUGH,ATTACK,MOVE,MOVE], spawn.room.energyCapacityAvailable / 2);
		let body = this.repeat([RANGED_ATTACK, MOVE], spawn.room.energyCapacityAvailable / 2);
		if (_.isEmpty(body))
			body = [MOVE, ATTACK];
		return spawn.enqueue(body, null, { home: roomName, role: 'defender' }, prio, 0, count);
	},

	requestPilot: function (spawn, roomName, count = 1) {
		const MAX_PILOT_ENERGY = 750;
		const amt = Math.clamp(SPAWN_ENERGY_START, spawn.room.energyAvailable, MAX_PILOT_ENERGY);
		let body = Arr.repeat([WORK, CARRY, MOVE, MOVE], amt);
		return spawn.enqueue(body, null, { role: 'pilot', home: roomName || spawn.pos.roomName }, 100, 0, count);
	},

	requestReserver: function (spawn, site, prio = 50) {
		if (!site) {
			Log.error("requestReserver expects site!");
			return;
		}
		let avail = spawn.room.energyCapacityAvailable;
		let body = this.repeat([MOVE, CLAIM], Math.min(avail, 6500));
		if (_.isEmpty(body))
			return ERR_RCL_NOT_ENOUGH;
		else
			return spawn.enqueue(body, null, { role: 'reserver', site: site }, prio, 0, 1, DEFAULT_SPAWN_JOB_EXPIRE);
	},

	requestHauler: function (spawn, memory, hasRoad = false, reqCarry = Infinity, prio = 10) {
		let avail = Math.max(300, spawn.room.energyCapacityAvailable) - 250;
		if (!hasRoad) {
			let howMuchCanWeBuild = Math.floor(avail / 100); // this.cost([CARRY,MOVE]);
			let howMuchDoWeWant = Math.ceil(reqCarry);
			let howCheapCanWeBe = Math.min(howMuchDoWeWant, howMuchCanWeBuild) * 100;
			howCheapCanWeBe = Math.max(UNIT_COST([WORK, WORK, MOVE, CARRY, MOVE]), howCheapCanWeBe);
			let body = [WORK, WORK, MOVE].concat(this.repeat([CARRY, MOVE], howCheapCanWeBe));
			let stats = _.countBy(body);
			Log.info('No road. Hauler parts avail: ' + ex(stats));
			Log.info('Total cost: ' + UNIT_COST(body) + ', build time: ' + 3 * body.length);
			spawn.enqueue(body, null, memory, prio);

		} else {
			let howMuchCanWeBuild = Math.floor(avail / 150); // this.cost([CARRY,CARRY,MOVE]);
			let howMuchDoWeWant = Math.ceil(reqCarry);
			// console.log(reqCarry);
			let howCheapCanWeBe = Math.min(howMuchDoWeWant, howMuchCanWeBuild) * (150 / 2);
			howCheapCanWeBe = Math.max(UNIT_COST([WORK, WORK, MOVE, CARRY, CARRY, MOVE]), howCheapCanWeBe);
			howCheapCanWeBe = Math.min(howCheapCanWeBe, 2200); // capped to 48 parts, and room for work/move
			let body = [WORK, WORK, MOVE].concat(this.repeat([CARRY, CARRY, MOVE], howCheapCanWeBe));
			// let stats = _.countBy(body);
			// Log.info('Have road. Hauler parts avail: ' + ex(stats));
			Log.info('Total cost: ' + UNIT_COST(body) + ', build time: ' + 3 * body.length);
			spawn.enqueue(body, null, memory, prio);
		}
		//
	},

	requestAttacker: function (spawn, body = Util.RLD([23, MOVE, 25, ATTACK, 2, MOVE])) {
		console.log('Attacker body: ' + body);
		return spawn.enqueue(body, null, { role: 'attack' }, 100);
	},

	requestFireTeam: function (s1, s2) {
		this.requestHealer(s1);
		this.requestHealer(s2);
		this.requestAttacker(s1);
		this.requestAttacker(s2);
		this.requestAttacker(s1);
		this.requestAttacker(s2);
	},

	requestPowerBankTeam: function (s1, s2) {
		let b1 = Arr.repeat([MOVE, HEAL], s1.room.energyCapacityAvailable);
		let b2 = Arr.repeat([MOVE, HEAL], s2.room.energyCapacityAvailable);
		this.requestHealer(s1, b1);
		this.requestHealer(s1, b1);
		this.requestHealer(s2, b2);
		this.requestAttacker(s1);
		this.requestAttacker(s2);
	},

	requestHealer: function (spawn, priority = 5) {
		let body = this.repeat([MOVE, HEAL], spawn.room.energyCapacityAvailable / 2);
		return spawn.enqueue(body, null, { role: 'healer' }, priority);
	},

	// Unit.requestGuard(Game.spawns.Spawn1, 'Guard2', Unit.repeat([MOVE,ATTACK],3000).sort())
	// [MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE,HEAL,HEAL]	
	// Unit.requestGuard(Game.spawns.Spawn1, 'Guard', [TOUGH,TOUGH,MOVE,MOVE,RANGED_ATTACK,MOVE,HEAL,HEAL,HEAL])
	// Unit.requestGuard(Game.spawns.Spawn1, 'Guard', [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,ATTACK,MOVE,ATTACK,MOVE,MOVE,ATTACK,ATTACK,HEAL,HEAL,HEAL,HEAL])
	// Unit.requestGuard(Game.spawns.Spawn1, 'Guard', [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,HEAL,HEAL,HEAL])
	// Unit.requestGuard(Game.spawns.Spawn1, 'Guard', Util.RLD([13,MOVE,4,RANGED_ATTACK,3,HEAL]))
	// Unit.requestGuard(Game.spawns.Spawn1, 'Test', [MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,HEAL,MOVE,ATTACK,MOVE,ATTACK])
	// Unit.requestGuard(Game.spawns.Spawn4, 'Guard2', [TOUGH,TOUGH,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,HEAL,HEAL,HEAL])
	// Unit.requestGuard(Game.spawns.Spawn4, 'Guard2', [MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK])
	// Unit.requestGuard(Game.spawns.Spawn2, 'Flag31', Util.RLD([10,TOUGH,20,MOVE,10,ATTACK]))
	// Unit.requestGuard(Game.spawns.Spawn8, 'Flag38', Util.RLD([5,TOUGH,10,MOVE,6,ATTACK]))
	// Unit.requestGuard(Game.spawns.Spawn4, 'Guard2', Util.RLD([5,TOUGH,20,MOVE,5,RANGED_ATTACK,2,HEAL]))
	// requestGuard: function(spawn, flag, body=[MOVE,MOVE,RANGED_ATTACK,HEAL]) {
	requestGuard: function (spawn, flag, body = [TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK]) {
		if (!flag || !(Game.flags[flag] instanceof Flag))
			return "Must specify flag";
		return spawn.enqueue(body, null, { role: 'guard', site: flag }, 100);
	},

	requestFaceTank: function (spawn, flag) {
		// let avail = spawn.room.energyCapacityAvailable;
		// let body = this.repeat([MOVE,ATTACK], avail).sort().reverse();
		const body = Arr.cycle([MOVE, ATTACK], MAX_CREEP_SIZE);
		console.log('body: ' + body.length);
		if (!flag || !(Game.flags[flag] instanceof Flag))
			return "Must specify flag";

		return spawn.enqueue(body, null, { role: 'guard', site: flag, home: spawn.pos.roomName }, 100);
	},

	requestRanger: function (spawn, flag) {
		let avail = spawn.room.energyCapacityAvailable;
		let body = this.repeat([TOUGH, MOVE, RANGED_ATTACK], avail).sort().reverse();
		console.log('body: ' + body);
		if (!flag || !(Game.flags[flag] instanceof Flag))
			return "Must specify flag";

		return spawn.enqueue(body, null, { role: 'guard', site: flag, home: spawn.pos.roomName }, 100);
	},

	// works for everything except role# roles.
	recovery: function () {
		_.each(Game.creeps, c => c.memory.role = c.name.replace(/[0-9]/g, ''));
	}

};
