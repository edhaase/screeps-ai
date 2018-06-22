/**
 * Unit.js
 *
 * Reoccuring unit management
 */
'use strict';

/* global PRIORITY_MIN, PRIORITY_LOW, PRIORITY_MED, PRIORITY_HIGH, PRIORITY_MAX */
/* global UNIT_COST, DEFAULT_SPAWN_JOB_EXPIRE */

const Arr = require('Arr');

const MAX_RCL_UPGRADER_SIZE = UNIT_COST([MOVE, MOVE, MOVE, CARRY]) + BODYPART_COST[WORK] * CONTROLLER_MAX_UPGRADE_PER_TICK * UPGRADE_CONTROLLER_POWER;

const MINING_BODIES = [
	// [WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE],
	[WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
	[WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE],
	[WORK, WORK, WORK, WORK, WORK, MOVE],
	[WORK, WORK, WORK, WORK, MOVE],
	[WORK, WORK, WORK, MOVE],
	[WORK, WORK, MOVE]
];

const REMOTE_MINING_BODIES = [
	// [WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE],
	[WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
	[WORK, WORK, WORK, WORK, WORK, MOVE, MOVE],
	[WORK, WORK, WORK, WORK, MOVE],
	[WORK, WORK, WORK, MOVE],
	[WORK, WORK, MOVE]
];

global.MAX_MINING_BODY = (amt) => _.find(MINING_BODIES, b => UNIT_COST(b) <= amt);

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
	/**
	 * Rather than creating and destroying groups, allow implied groups by id?
	 * An id might be a position or flag name.
	 */
	getCreepsByGroupID() {
		return _.groupBy(Game.creeps, 'memory.gid');
	},


	Body: Body,

	listAges: () => _.map(Game.creeps, c => Game.time - c.memory.born),
	oldestCreep: () => _.max(Game.creeps, c => Game.time - c.memory.born),

	/**
	 * Sort a creep body so that 1 of each part (except tough)
	 * ends up on the end, then sorts as normal. 
	 */
	tailSort(body) {
		var first = {};
		var order = [TOUGH, WORK, CARRY, RANGED_ATTACK, ATTACK, CLAIM, MOVE, HEAL];
		return _.sortBy(body, function (part) {
			if (part !== TOUGH && first[part] === undefined) {
				first[part] = false;
				return 1000 - order.indexOf(part); // Arbritarly large number.
			} else {
				return order.indexOf(part);
			}
		});
	},

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

	// (spawn, this.pos, this.memory.work, this.pos.roomName
	requestRemoteMiner: function (spawn, pos, work = SOURCE_HARVEST_PARTS, room) {
		const body = _.find(REMOTE_MINING_BODIES, b => UNIT_COST(b) <= spawn.room.energyCapacityAvailable && _.sum(b, bp => bp === WORK) <= work + 1);
		const cost = UNIT_COST(body);
		if (!body || !body.length)
			return;
		spawn.submit({
			body,
			memory: { role: 'miner', dest: pos, travelTime: 0 },
			priority: PRIORITY_HIGH,
			room,
			expire: DEFAULT_SPAWN_JOB_EXPIRE
		});
	},

	/**
	 * Request miner
	 */
	requestMiner: function (spawn, dest, priority = 8) {
		const body = _.find(MINING_BODIES, b => UNIT_COST(b) <= spawn.room.energyCapacityAvailable);
		spawn.submit({ body, memory: { role: 'miner', dest: dest, home: dest.roomName, travelTime: 0 }, priority, expire: DEFAULT_SPAWN_JOB_EXPIRE });
	},

	/**
	 * Biggest we can! Limit to 15 work parts
	 * requestUpgrader(firstSpawn,1,5,49)
	 */
	requestUpgrader: function (spawn, home, priority = PRIORITY_MED, workDiff) {
		var body = [];
		if (workDiff <= 0)
			return ERR_INVALID_ARGS;
		// energy use is  active work * UPGRADE_CONTROLLER_POWER, so 11 work parts is 11 ept, over half a room's normal production
		// let max = 2500;
		// @todo Are we sure we're sizing this right?
		const { controller } = spawn.room;
		const avail = Math.max(250, spawn.room.energyCapacityAvailable - (SPAWN_ENERGY_CAPACITY * 0.20));
		if (controller.level <= 2) {
			body = [CARRY, MOVE, WORK, WORK];
		} else if (spawn.pos.roomName !== home) {
			body = Arr.repeat([WORK, CARRY, MOVE], avail);
		} else {
			var count = Math.min(workDiff, 1 + Math.floor((avail - 300) / BODYPART_COST[WORK])) || 1;
			let ccarry = 1;
			if (count > 5) {
				ccarry += 2;
				count -= 2;
			}
			if (ccarry + count + 3 > MAX_CREEP_SIZE)
				count = MAX_CREEP_SIZE - (ccarry + 3);
			body = Util.RLD([ccarry, CARRY, count, WORK, 3, MOVE]);
		}
		// Log.debug(`Workdiff: ${workDiff}, count: ${count}, body: ${body}`);
		return spawn.submit({ body, memory: { role: 'upgrader', home }, priority });
	},

	requestWarMiner: function (spawn, memory, room) {
		if (!memory)
			throw new TypeError('Memory must be supplied');
		const { body } = require('role-war-miner');
		return spawn.submit({ body, memory, priority: PRIORITY_LOW, room: room || spawn.pos.roomName });
	},

	/**
	 * Biggest we can!
	 * WARNING: _5_ energy per tick per part, not 1.
	 */
	requestBuilder: function (spawn, { elimit = 20, home, body, num = 1, priority = PRIORITY_MED } = {}) {
		// let avail = Math.clamp(300, spawn.room.energyCapacityAvailable, 2000);
		const partLimit = Math.floor(elimit / BUILD_POWER);
		const avail = Math.max(SPAWN_ENERGY_START, spawn.room.energyCapacityAvailable * 0.80);
		const pattern = [MOVE, MOVE, MOVE, WORK, WORK, CARRY];
		const cost = UNIT_COST(pattern);
		const al = Math.min(Math.floor(cost * (partLimit / 2)), avail);
		// console.log(`Pattern cost: ${cost}, avail: ${avail}, limit: ${al}`);
		if (body == null)
			body = Arr.repeat(pattern, al); // 400 energy gets me 2 work parts.
		if (_.isEmpty(body)) {
			body = [WORK, CARRY, MOVE, MOVE];
		}
		return spawn.submit({ body, memory: { role: 'builder', home }, priority });
	},

	requestBulldozer: function (spawn, roomName) {
		// const body = [WORK, WORK, MOVE, MOVE];
		const body = require('role-bulldozer').body({ room: spawn.room });
		return spawn.submit({ body, memory: { role: 'bulldozer', site: roomName }, priority: PRIORITY_LOW });
	},

	requestDualMiner: function (spawn, home, totalCapacity, steps) {
		const body = require('role-dualminer').body({ totalCapacity, steps });
		const cost = UNIT_COST(body);
		if (spawn.room.energyCapacityAvailable < cost) {
			Log.warn('Body of creep is too expensive for the closest spawn', 'Controller');
			return false;
		}
		// var priority = (spawn.pos.roomName === home) ? PRIORITY_MED : 10;
		return spawn.submit({ body, memory: { role: 'dualminer', site: home }, priority: PRIORITY_MED, home });
	},

	/**
	 * Biggest we can!
	 */
	requestRepair: function (spawn, home, ept = 1) {
		const pattern = [WORK, CARRY, MOVE, MOVE];
		const cost = UNIT_COST(pattern);
		const can = Math.floor(spawn.room.energyCapacityAvailable / cost);
		const body = Arr.repeat(pattern, cost * Math.min(ept, can));
		return spawn.submit({ body, memory: { role: 'repair', home }, priority: PRIORITY_LOW, expire: DEFAULT_SPAWN_JOB_EXPIRE });
	},

	requestScav: function (spawn, home = null, canRenew = true, priority = PRIORITY_MED, hasRoad = true) {
		var memory = {
			role: 'scav',
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
			body = Arr.repeat([CARRY, CARRY, MOVE], avail);
		else
			body = Arr.repeat([CARRY, MOVE], avail);
		body.unshift(WORK);
		body.unshift(MOVE);
		if (!body || body.length <= 3) {
			console.log("Unable to build scav");
		} else {
			return spawn.submit({ body, memory, priority, home });
		}
	},

	requestClaimer: function (spawn) {
		const body = [CLAIM, MOVE];
		let cost = UNIT_COST(body);
		while (cost < spawn.room.energyCapacityAvailable && body.length < 6) {
			body.push(MOVE);
			cost += BODYPART_COST[MOVE];
		}
		return spawn.submit({ body, memory: { role: 'claimer', } });
	},

	requestScout: function (spawn, memory = {}, priority = PRIORITY_LOW) {
		memory.role = 'scout';
		return spawn.submit({ body: [MOVE], memory, priority });
	},

	requestDefender: function (spawn, roomName, priority = PRIORITY_HIGH) {
		let body = Arr.repeat([TOUGH, ATTACK, MOVE, MOVE], spawn.room.energyCapacityAvailable / 2);
		// let body = this.repeat([RANGED_ATTACK, MOVE], spawn.room.energyCapacityAvailable / 2);
		if (_.isEmpty(body))
			body = [MOVE, ATTACK];
		return spawn.submit({ body, memory: { role: 'defender', home: roomName }, priority });
	},

	requestRanger: function (spawn, roomName, priority = PRIORITY_HIGH) {
		const body = Arr.repeat([RANGED_ATTACK, MOVE], spawn.room.energyCapacityAvailable / 2);
		return spawn.submit({ body, memory: { role: 'defender', home: roomName }, priority });
	},

	requestPilot: function (spawn, roomName) {
		const MAX_PILOT_ENERGY = 750;
		const amt = Math.clamp(SPAWN_ENERGY_START, spawn.room.energyAvailable, MAX_PILOT_ENERGY);
		const body = Arr.repeat([WORK, CARRY, MOVE, MOVE], amt);
		return spawn.submit({ body, memory: { role: 'pilot', home: roomName || spawn.pos.roomName }, priority: PRIORITY_MAX });
	},

	requestMineralHarvester(spawn, site, cid) {
		const body = Arr.repeat([WORK, WORK, MOVE], spawn.room.energyCapacityAvailable);
		const memory = { role: 'harvester', site, cid };
		return spawn.submit({ body, memory, priority: PRIORITY_LOW });
	},

	requestReserver: function (spawn, site, priority = PRIORITY_LOW, size = Infinity) {
		if (!site)
			throw new Error('Site can not be empty!');
		const cost = UNIT_COST([MOVE, CLAIM]);
		const canBuild = Math.floor(spawn.room.energyCapacityAvailable / cost);
		const remainder = spawn.room.energyCapacityAvailable % cost;	// for spare parts like [MOVE,ATTACK]
		const building = Math.min(size, canBuild) * cost;
		const body = Arr.repeat([MOVE, CLAIM], building);
		if (_.isEmpty(body) || body.length <= 2)
			return ERR_RCL_NOT_ENOUGH;
		else
			return spawn.submit({ body, room: site.roomName, memory: { role: 'reserver', site }, priority });
	},

	requestHauler: function (spawn, memory, hasRoad = false, reqCarry = Infinity, priority = PRIORITY_LOW, room) {
		var avail = Math.max(SPAWN_ENERGY_START, spawn.room.energyCapacityAvailable) - 250;
		var body;
		if (!hasRoad) {
			const cost = UNIT_COST([MOVE, CARRY]);
			const howMuchCanWeBuild = Math.floor(avail / cost);
			const howMuchDoWeWant = Math.ceil(reqCarry);
			let howCheapCanWeBe = Math.min(howMuchDoWeWant, howMuchCanWeBuild) * cost;
			howCheapCanWeBe = Math.max(cost, howCheapCanWeBe);
			Log.info(`Want: ${howMuchDoWeWant}, Avail: ${howMuchCanWeBuild}, How Cheap: ${howCheapCanWeBe}, Build: ${howCheapCanWeBe / cost}`, 'Creep');
			body = Arr.repeat([CARRY, MOVE], howCheapCanWeBe);
		} else {
			const cost = UNIT_COST([CARRY, CARRY, MOVE]);
			const howMuchCanWeBuild = Math.floor(avail / cost); // this.cost([CARRY,CARRY,MOVE]);
			const howMuchDoWeWant = Math.ceil(reqCarry);
			// console.log(reqCarry);
			let howCheapCanWeBe = Math.min(howMuchDoWeWant, howMuchCanWeBuild) * (cost / 2);
			howCheapCanWeBe = Math.max(UNIT_COST([WORK, WORK, MOVE, CARRY, CARRY, MOVE]), howCheapCanWeBe);
			howCheapCanWeBe = Math.min(howCheapCanWeBe, 2200); // capped to 48 parts, and room for work/move
			Log.info(`Want: ${howMuchDoWeWant}, Avail: ${howMuchCanWeBuild}, How Cheap: ${howCheapCanWeBe}`, 'Creep');
			body = [WORK, WORK, MOVE].concat(Arr.repeat([CARRY, CARRY, MOVE], howCheapCanWeBe));
		}
		const cost = UNIT_COST(body);
		const carry = _.sum(body, p => p === CARRY) * CARRY_CAPACITY;
		memory.ept = carry / memory.steps / 2; // For round trip
		memory.eptNet = memory.ept - cost / CREEP_LIFE_TIME; // Account for expense
		if (cost <= spawn.room.energyCapacityAvailable)
			spawn.submit({ body, memory, priority, room });
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

	requestHealer: function (spawn, roomName, priority = PRIORITY_MED) {
		const body = Arr.repeat([MOVE, HEAL], spawn.room.energyCapacityAvailable / 2);
		if (_.isEmpty(body))
			return null;
		return spawn.submit({ body, memory: { role: 'healer', home: roomName }, priority });
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
	requestGuard: function (spawn, flag, body, room) {
		if (!flag || !(Game.flags[flag] instanceof Flag))
			throw new TypeError("Expected flag");
		if (body == null || !body.length) {
			body = [HEAL, MOVE];
			const cost = UNIT_COST(body);
			const avail = Math.floor((spawn.room.energyCapacityAvailable - cost) * 0.80);
			if (spawn.room.energyCapacityAvailable > 1260) {
				body = Arr.repeat([HEAL, RANGED_ATTACK, ATTACK, MOVE, MOVE, MOVE], avail);
			} else if (Math.random() < 0.80) {
				body = body.concat(Arr.repeat([RANGED_ATTACK, MOVE], avail));
			} else {
				body = body.concat(Arr.repeat([ATTACK, MOVE], avail));
			}
			// body = body.concat(Arr.repeat([RANGED_ATTACK, MOVE], avail));
		}
		if (body.length <= 2)
			body = [RANGED_ATTACK, MOVE];
		return spawn.submit({ body, memory: { role: 'guard', site: flag, origin: spawn.pos.roomName }, priority: PRIORITY_HIGH, room });
	},

	requestSwampGuard: function (spawn, flag, body, room) {
		body = [MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
		const cost = UNIT_COST(body);
		const avail = Math.floor((spawn.room.energyCapacityAvailable - cost) * 0.75);
		body = body.concat(Arr.repeat([MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK], avail));
		return spawn.submit({ body, memory: { role: 'guard', site: flag, origin: spawn.pos.roomName }, priority: PRIORITY_HIGH, room });
	}
};
