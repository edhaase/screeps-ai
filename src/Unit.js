/**
 * Unit.js
 *
 * Reoccuring unit management
 */
'use strict';

/* global PRIORITY_MIN, PRIORITY_LOW, PRIORITY_MED, PRIORITY_HIGH, PRIORITY_MAX */
/* global UNIT_COST, DEFAULT_SPAWN_JOB_EXPIRE */
import { Log } from '/os/core/Log';
import Body from '/ds/Body';
import { RLD } from '/lib/util';
import ROLES from '/role/index';
import { CLAMP } from '/os/core/math';

const MAX_RCL_UPGRADER_SIZE = UNIT_COST([MOVE, MOVE, MOVE, CARRY]) + BODYPART_COST[WORK] * CONTROLLER_MAX_UPGRADE_PER_TICK * UPGRADE_CONTROLLER_POWER;

const REMOTE_MINING_BODIES = [
	// [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
	[WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
	[WORK, WORK, WORK, WORK, WORK, MOVE, MOVE],
	[WORK, WORK, WORK, WORK, MOVE],
	[WORK, WORK, WORK, MOVE],
	[WORK, WORK, MOVE]
];

global.MAX_MINING_BODY = (amt) => _.find(MINING_BODIES, b => UNIT_COST(b) <= amt);

/**
	 * Rather than creating and destroying groups, allow implied groups by id?
	 * An id might be a position or flag name.
	 */
export function getCreepsByGroupID() {
	return _.groupBy(Game.creeps, 'memory.gid');
};

export function listAges() {
	return _.map(Game.creeps, c => Game.time - c.memory.born);
};

export function oldestCreep() {
	return _.max(Game.creeps, c => Game.time - c.memory.born);
};

/**
 * Sort a creep body so that 1 of each part (except tough)
 * ends up on the end, then sorts as normal. 
 */
export function tailSort(body) {
	var first = {};
	var order = [TOUGH, WORK, CARRY, RANGED_ATTACK, ATTACK, CLAIM, MOVE, HEAL];
	return _.sortBy(body, function (part) {
		if (part !== TOUGH && first[part] === undefined) {
			first[part] = false;
			return 1000 - order.indexOf(part) * -1; // Arbritarly large number.
		} else {
			return order.indexOf(part);
		}
	});
};

export function sort(body) {
	return _.sortBy(body, p => _.indexOf([TOUGH, MOVE, WORK, CARRY, ATTACK, RANGED_ATTACK, HEAL, CLAIM], p));
};

export function shuffle(body) {
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
};

// (spawn, this.pos, this.memory.work, this.pos.roomName
export function requestRemoteMiner(spawn, pos, work = SOURCE_HARVEST_PARTS, room) {
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
};

/**
 * Request miner
 */
export function requestMiner(spawn, source, priority = 8) {
	spawn.submit({
		harvestParts: source.harvestParts,
		memory: { role: 'miner', dest: source.pos, home: source.pos.roomName, travelTime: 0 }, priority, expire: DEFAULT_SPAWN_JOB_EXPIRE
	});
};

/**
 * Biggest we can! Limit to 15 work parts
 * requestUpgrader(firstSpawn,1,5,49)
 */
export function requestUpgrader(spawn, home, priority = PRIORITY_MED, workDiff) {
	var body = [];
	if (workDiff <= 0)
		return ERR_INVALID_ARGS;
	// energy use is  active work * UPGRADE_CONTROLLER_POWER, so 11 work parts is 11 ept, over half a room's normal production
	// let max = 2500;
	// @todo Are we sure we're sizing this right?
	const avail = Math.max(SPAWN_ENERGY_START, spawn.room.energyCapacityAvailable);
	if (spawn.pos.roomName !== home) {
		body = Body.repeat([WORK, CARRY, MOVE, MOVE], avail);
	} else {
		const [w, c, m] = [0.70 * avail, 0.10 * avail, 0.20 * avail];
		const [lw, lc, lm] = [0.70 * MAX_CREEP_SIZE, 0.10 * MAX_CREEP_SIZE, 0.20 * MAX_CREEP_SIZE];

		// Optional, distribute remainder of energy to WORK part,
		// At rcl 2 plus extensions that's 550 energy or 4 WORK, 1 CARRY, 2 MOVE
		// Without remainder redistribute we'd have 3-1-2
		Log.debug(`Upgrader energy available: ${avail} = ${w} + ${c} + ${m}`, 'Unit');
		const pc = CLAMP(1, Math.floor(c / BODYPART_COST[CARRY]), lc);
		const pm = CLAMP(1, Math.floor(m / BODYPART_COST[MOVE]), lm);
		const rc = c - pc * BODYPART_COST[CARRY];
		const rm = m - pm * BODYPART_COST[MOVE];
		const rem = rc + rm;
		const pw = CLAMP(1, Math.floor((w + rem) / BODYPART_COST[WORK]), Math.min(lw, workDiff));
		const am = CLAMP(1, pm, Math.ceil(pc + pw / 2));
		Log.debug(`Upgrader energy remaining: ${rc} ${rm} = ${rem}`, 'Unit');
		Log.debug(`Upgrader parts available: ${pw} ${pc} ${am}`, 'Unit');
		body = RLD([pw, WORK, pc, CARRY, am, MOVE]);
	}
	// Log.debug(`Workdiff: ${workDiff}, count: ${count}, body: ${body}`);
	return spawn.submit({ body, memory: { role: 'upgrader', home }, priority });
};

/**
 * Biggest we can!
 * WARNING: _5_ energy per tick per part, not 1.
 */
export function requestBuilder(spawn, { elimit = 20, home, priority = PRIORITY_MED } = {}) {
	const body = ROLES['builder'].body(spawn, { elimit });
	return spawn.submit({ body, memory: { role: 'builder', home }, priority });
};

export function requestBulldozer(spawn, roomName) {
	// const body = [WORK, WORK, MOVE, MOVE];
	// const body = require('/role/bulldozer').body({ room: spawn.room });
	const body = ROLES['bulldozer'].body({ room: spawn.room });
	return spawn.submit({ body, memory: { role: 'bulldozer', home: roomName }, priority: PRIORITY_LOW });
};

export function requestDualMiner(spawn, home, totalCapacity, steps, priority = PRIORITY_MED) {
	// const body = require('/role/dualminer').body({ totalCapacity, steps });
	const body = ROLES['dualminer'].body({ totalCapacity, steps });
	if (!body || !body.length)
		return false;
	const cost = UNIT_COST(body);
	if (spawn.room.energyCapacityAvailable < cost) {
		Log.warn(`${spawn}/${spawn.pos} body of creep dualminer is too expensive for spawn`, 'Controller');
		return false;
	}
	// var priority = (spawn.pos.roomName === home) ? PRIORITY_MED : 10;
	return spawn.submit({ body, memory: { role: 'dualminer', home }, priority });
};

/**
 * Biggest we can!
 */
export function requestRepair(spawn, home, ept = 1) {
	const pattern = [WORK, CARRY, MOVE, MOVE];
	const cost = UNIT_COST(pattern);
	const can = Math.floor(spawn.room.energyCapacityAvailable / cost);
	const body = Body.repeat(pattern, cost * Math.min(ept, can));
	return spawn.submit({ body, memory: { role: 'repair', home }, priority: PRIORITY_LOW, expire: DEFAULT_SPAWN_JOB_EXPIRE });
};

export function requestScav(spawn, home = null, canRenew = true, priority = PRIORITY_MED, hasRoad = true) {
	var memory = {
		role: 'scav',
		eca: spawn.room.energyCapacityAvailable
	};
	memory.home = home || spawn.pos.roomName;

	// let capacity = spawn.room.energyCapacityAvailable;
	// reduce max size so we don't need a "full" room, which seems rare
	let capacity = Math.ceil(spawn.room.energyCapacityAvailable * 0.75);
	if (home !== spawn.pos.roomName)
		capacity /= 2; // Smaller scavs in remote rooms.
	// var body, avail = CLAMP(250, capacity, 1500) - BODYPART_COST[WORK];
	var body, avail = CLAMP(250, capacity, 1500) - UNIT_COST([WORK, MOVE]);
	if (hasRoad)
		body = Body.repeat([CARRY, CARRY, MOVE], avail);
	else
		body = Body.repeat([CARRY, MOVE], avail);
	body.unshift(WORK);
	body.unshift(MOVE);
	if (!body || body.length <= 3) {
		Log.warn(`Unable to build scav for room ${home}`, 'Unit');
	} else {
		return spawn.submit({ body, memory, priority });
	}
};

export function requestClaimer(spawn) {
	const body = [CLAIM, MOVE];
	let cost = UNIT_COST(body);
	while (cost < spawn.room.energyCapacityAvailable && body.length < 6) {
		body.push(MOVE);
		cost += BODYPART_COST[MOVE];
	}
	return spawn.submit({ body, memory: { role: 'claimer', } });
};

export function requestScout(spawn, memory = {}, priority = PRIORITY_LOW) {
	memory.role = 'scout';
	return spawn.submit({ body: [MOVE], memory, priority });
};

export function requestDefender(spawn, roomName, priority = PRIORITY_HIGH) {
	let body = Body.repeat([TOUGH, ATTACK, MOVE, MOVE], spawn.room.energyCapacityAvailable / 2);
	// let body = this.repeat([RANGED_ATTACK, MOVE], spawn.room.energyCapacityAvailable / 2);
	if (_.isEmpty(body))
		body = [MOVE, ATTACK];
	return spawn.submit({ body, memory: { role: 'defender', home: roomName }, priority });
};

export function requestRanger(spawn, roomName, priority = PRIORITY_HIGH) {
	const body = Body.repeat([RANGED_ATTACK, MOVE], spawn.room.energyCapacityAvailable / 2);
	return spawn.submit({ body, memory: { role: 'defender', home: roomName }, priority });
};

export function requestPilot(spawn, roomName) {
	return spawn.submit({ memory: { role: 'pilot', home: roomName || spawn.pos.roomName }, priority: PRIORITY_MAX });
};

export function requestMineralHarvester(spawn, site, cid) {
	const body = [CARRY, CARRY].concat(Body.repeat([WORK, WORK, MOVE], spawn.room.energyCapacityAvailable - BODYPART_COST[CARRY] * 2));
	const memory = { role: 'harvester', site, cid };
	return spawn.submit({ body, memory, priority: PRIORITY_LOW });
};

export function requestReserver(spawn, site, priority = PRIORITY_LOW, size = Infinity) {
	if (!site)
		throw new Error('Site can not be empty!');
	const cost = UNIT_COST([MOVE, CLAIM]);
	const canBuild = Math.floor(spawn.room.energyCapacityAvailable / cost);
	const remainder = spawn.room.energyCapacityAvailable % cost;	// for spare parts like [MOVE,ATTACK]
	const building = Math.min(size, canBuild) * cost;
	const body = Body.repeat([MOVE, CLAIM], building);
	if (_.isEmpty(body) || body.length <= 2)
		return ERR_RCL_NOT_ENOUGH;
	else
		return spawn.submit({ body, room: site.roomName, memory: { role: 'reserver', site }, priority });
};

export function requestHauler(spawn, memory, hasRoad = false, reqCarry = Infinity, priority = PRIORITY_LOW, room) {
	var avail = Math.max(SPAWN_ENERGY_START, spawn.room.energyCapacityAvailable) - 250;
	var body;
	if (!hasRoad) {
		const cost = UNIT_COST([MOVE, CARRY]);
		const howMuchCanWeBuild = Math.floor(avail / cost);
		const howMuchDoWeWant = Math.ceil(reqCarry);
		let howCheapCanWeBe = Math.min(howMuchDoWeWant, howMuchCanWeBuild) * cost;
		howCheapCanWeBe = Math.max(cost, howCheapCanWeBe);
		Log.info(`Want: ${howMuchDoWeWant}, Avail: ${howMuchCanWeBuild}, How Cheap: ${howCheapCanWeBe}, Build: ${howCheapCanWeBe / cost}`, 'Creep');
		body = Body.repeat([CARRY, MOVE], howCheapCanWeBe);
	} else {
		const cost = UNIT_COST([CARRY, CARRY, MOVE]);
		const howMuchCanWeBuild = Math.floor(avail / cost); // this.cost([CARRY,CARRY,MOVE]);
		const howMuchDoWeWant = Math.ceil(reqCarry);
		let howCheapCanWeBe = Math.min(howMuchDoWeWant, howMuchCanWeBuild) * (cost / 2);
		howCheapCanWeBe = Math.max(UNIT_COST([WORK, WORK, MOVE, CARRY, CARRY, MOVE]), howCheapCanWeBe);
		howCheapCanWeBe = Math.min(howCheapCanWeBe, 2200); // capped to 48 parts, and room for work/move
		Log.info(`Want: ${howMuchDoWeWant}, Avail: ${howMuchCanWeBuild}, How Cheap: ${howCheapCanWeBe}`, 'Creep');
		body = [WORK, WORK, MOVE].concat(Body.repeat([CARRY, CARRY, MOVE], howCheapCanWeBe));
	}
	const cost = UNIT_COST(body);
	const carry = _.sum(body, p => p === CARRY) * CARRY_CAPACITY;
	memory.ept = carry / memory.steps / 2; // For round trip
	memory.eptNet = memory.ept - cost / CREEP_LIFE_TIME; // Account for expense
	if (cost <= spawn.room.energyCapacityAvailable)
		spawn.submit({ body, memory, priority, room });
};

export function requestFireTeam(s1, s2) {
	this.requestHealer(s1);
	this.requestHealer(s2);
	this.requestAttacker(s1);
	this.requestAttacker(s2);
	this.requestAttacker(s1);
	this.requestAttacker(s2);
};

export function requestPowerBankTeam(s1, s2) {
	const b1 = Body.repeat([MOVE, HEAL], s1.room.energyCapacityAvailable);
	const b2 = Body.repeat([MOVE, HEAL], s2.room.energyCapacityAvailable);
	this.requestHealer(s1, b1);
	this.requestHealer(s1, b1);
	this.requestHealer(s2, b2);
	this.requestAttacker(s1);
	this.requestAttacker(s2);
};

export function requestHealer(spawn, roomName, priority = PRIORITY_MED) {
	const body = Body.repeat([MOVE, HEAL], spawn.room.energyCapacityAvailable / 2);
	if (_.isEmpty(body))
		return null;
	return spawn.submit({ body, memory: { role: 'healer', home: roomName }, priority });
};

export function requestGuard(spawn, flag, room) {
	if (!flag || !(Game.flags[flag] instanceof Flag))
		throw new TypeError("Expected flag");
/*	var body = [HEAL, MOVE];
	const cost = UNIT_COST(body);
	const avail = Math.floor((spawn.room.energyCapacityAvailable - cost) * 0.98);

 	if (spawn.room.energyCapacityAvailable > 1260 && r < 0.10) {
		body = Body.repeat([HEAL, RANGED_ATTACK, ATTACK, MOVE, MOVE, MOVE], avail);
	} else if (r < 0.80) {
		body = body.concat(Body.repeat([RANGED_ATTACK, MOVE], avail, MAX_CREEP_SIZE - body.length)); // These don't work
	} else {
		body = body.concat(Body.repeat([ATTACK, MOVE], avail, MAX_CREEP_SIZE - body.length));
	}
	if (body.length <= 2)
		body = [RANGED_ATTACK, MOVE];
	return spawn.submit({ body, memory: { role: 'guard', site: flag, origin: spawn.pos.roomName }, priority: PRIORITY_HIGH, room });  */
	return spawn.submit({ memory: { role: 'guard', site: flag, origin: spawn.pos.roomName }, priority: PRIORITY_HIGH, room }); 
};

export function requestG2Melee(spawn, en) {
	const energyCapacityAvailable = en || spawn.room.energyCapacityAvailable;
	// Log.debug(`Total: ${energyCapacityAvailable}`);
	const avail = Math.floor(energyCapacityAvailable * 0.98);
	const [a, m, h] = [0.30 * avail, 0.50 * avail, 0.20 * avail];
	const [la, lm, lh] = [0.40 * MAX_CREEP_SIZE, 0.50 * MAX_CREEP_SIZE, 0.10 * MAX_CREEP_SIZE];
	// Log.debug(`${a} ${h} ${m}`);
	// Log.debug(`${la} ${lh} ${lm}`);
	const pa = CLAMP(1, Math.floor(a / BODYPART_COST[ATTACK]), la);
	const pm = CLAMP(1, Math.floor(m / BODYPART_COST[MOVE]), lm);
	const ph = CLAMP(1, Math.floor(h / BODYPART_COST[HEAL]), lh);
	// Log.debug(`${pa} ${ph} ${pm}`);
	const ra = a - pa * BODYPART_COST[ATTACK];
	const rm = m - pm * BODYPART_COST[MOVE];
	const rh = h - ph * BODYPART_COST[HEAL];
	const rem = ra + rm + rh;
	const pcw = CLAMP(1, Math.floor((m + rem) / BODYPART_COST[MOVE]), lm);
	// Log.debug(`ra ${ra} rm ${rm} rh ${rh} rem ${rem} pcw ${pcw}`);
	// Log.debug(`[${pa},ATTACK,${pcw},MOVE,${ph},HEAL]`);
	const body = RLD([pa, ATTACK, pcw, MOVE, ph, HEAL]);
	const cost = UNIT_COST(body);
	// Log.warn(`Body cost: ${cost}`);
	return body;
};

export function requestG2(spawn, en, flag, room) {
	const energyCapacityAvailable = en || spawn.room.energyCapacityAvailable;
	Log.debug(`Total: ${energyCapacityAvailable}`);
	const avail = Math.floor(energyCapacityAvailable * 0.98);
	const [c, h, m] = [0.40 * avail, 0.40 * avail, 0.20 * avail];
	const [lc, lh, lm] = [0.40 * MAX_CREEP_SIZE, 0.10 * MAX_CREEP_SIZE, 0.5 * MAX_CREEP_SIZE];
	Log.debug(`${c} ${h} ${m}`);
	Log.debug(`${lc} ${lh} ${lm}`);
	const pc = CLAMP(1, Math.floor(c / BODYPART_COST[RANGED_ATTACK]), lc);
	const ph = CLAMP(1, Math.floor(h / BODYPART_COST[HEAL]), lh);
	const pm = CLAMP(1, Math.floor(m / BODYPART_COST[MOVE]), lm);
	Log.debug(`${pc} ${ph} ${pm}`);
	const rc = c - pc * BODYPART_COST[RANGED_ATTACK];
	const rm = m - pm * BODYPART_COST[MOVE];
	const rh = h - ph * BODYPART_COST[HEAL];
	const rem = rc + rm + rh;
	const pcw = CLAMP(1, Math.floor((c + rem) / BODYPART_COST[RANGED_ATTACK]), lc);
	Log.debug(`rc ${rc} rm ${rm} rh ${rh} rem ${rem} pcw ${pcw}`);
	const body = RLD([pcw, RANGED_ATTACK, pm, MOVE, ph, HEAL]);
	const cost = UNIT_COST(body);
	Log.warn(`Body cost: ${cost}`);
};

export function requestSwampGuard(spawn, flag, body, room) {
	body = [MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
	const cost = UNIT_COST(body);
	const avail = Math.floor((spawn.room.energyCapacityAvailable - cost) * 0.75);
	body = body.concat(Body.repeat([MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK], avail));
	return spawn.submit({ body, memory: { role: 'guard', site: flag, origin: spawn.pos.roomName }, priority: PRIORITY_HIGH, room });
}
