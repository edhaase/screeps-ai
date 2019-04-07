/**
 * CostMatrix.js
 *
 * ES6 class support for cost matricies
 */
'use strict';

/* global Log, Player */
/* eslint-disable no-magic-numbers */

const Intel = require('Intel');
const DelegatingLazyMap = require('os.ds.dele.lazymap');
const LRU = require('os.ds.lru');
const { VisibilityError } = require('os.core.errors');

const COST_MATRIX_EXPIRATION = 5;
const COST_MATRIX_CACHE_SIZE = 150;

const CostMatrix = require('os.ds.costmatrix.room');
const TILE_UNWALKABLE = 255;

/**
 * The fixed obstacle matrix stores a position of obstacles in the world
 * that don't change often. Walls, structures, etc.
 */
class FixedObstacleMatrix extends CostMatrix {
	constructor(roomName) {
		super(Game.rooms[roomName]);
		if (!_.isString(roomName))
			throw new TypeError("FixedObstacleMatrix expects roomName string");

		const room = Game.rooms[roomName];
		if (!room)
			return;
		// don't forget enemy non-public ramparts!
		this.setRoads(room);
		this.setFixedObstacles(room);
		this.setDynamicObstacles(room);
		this.setSKLairs(room);
		this.setExitTiles(room, 5);
		this.setPortals(room);
	}
}

global.FixedObstacleMatrix = FixedObstacleMatrix;

/**
 * Logistics matrix roughly combines obstacle matrix with road matrix
 * to find optimal shipping lane.
 */
class LogisticsMatrix extends CostMatrix {
	/**
	 * @param {string} roomName 
	 * @throws Error
	 */
	constructor(roomName) {
		super(Game.rooms[roomName]);

		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);

		if (room.controller) // @todo if not a wall..
			this.applyInRoomRadius((x, y) => this.set(x, y, 1), room.controller.pos, 3);
		this.setRoads(room);
		this.setFixedObstacles(room);
		this.setDynamicObstacles(room);
		this.setSKLairs(room);
		this.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_POWER_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, (c) => c.memory.stuck > 3, FIND_MY_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, (c) => c.memory.stuck > 3, FIND_MY_POWER_CREEPS);
		this.setExitTiles(room, 5);
		this.setPortals(room, 254);
	}
}

/**
 * Where are we most likely to get horribly murdered?
 */
class TowerThreatMatrix extends CostMatrix {
	constructor(room) {
		if (_.isString(room))
			if (Game.rooms[room])
				room = Game.rooms[room];
		super(room);
		_.each(
			room.find(FIND_STRUCTURES, { filter: t => (t.structureType === STRUCTURE_TOWER) }),
			this.addTower, this);
	}

	addTower(target) {
		// Just trust that this works..
		this.apply((x, y) => this.add(x, y,
			CLAMP(TOWER_OPTIMAL_RANGE,
				TOWER_FALLOFF_RANGE - target.pos.getRangeTo(x, y),
				TOWER_FALLOFF_RANGE) - TOWER_OPTIMAL_RANGE
		));
	}
}

/** Lazy factory */
class LazyPropertyFactory {
	constructor(fn = () => 3) {
		this.fn = fn;
	}

	get(target, key, proxy) {
		if (target[key] === undefined)
			target[key] = this.fn(key);
		return target[key];
	}

	set(target, key, value, proxy) {
		return target[key] = value;
	}
}

/* eslint-disable class-methods-use-this */
/* const MAX_CACHE_COSTMATRIX_AGE = 5;
class LazyMatrixStore {
	constructor(clazz, maxAge = MAX_CACHE_COSTMATRIX_AGE) {
		this.clazz = clazz;
		this.maxAge = maxAge;
	}

	get(target, key, proxy) {
		Log.debug(`Requesting ${this.clazz.name} cost matrix for ${key}`, 'Matrix');
		var ck = `${this.clazz.name}_${key}`;
		var cm = target.get(ck);
		if(!cm) {
			if (Game.rooms[key]) {
				Log.info(`Creating cost matrix for ${ck} (Tick ${Game.time})`, 'Matrix');
				proxy[key] = new this.clazz(key);
			} else {
				// console.log('Loading obstacle matrix for ' + key);
				// Log.debug(`Loading cost matrix for ${key} from memory`, 'Matrix');
				// let om = _.get(Memory.rooms, key + '.cm.obstacle');
				// target[key] = (om) ? CostMatrix.deserialize(om) : new PathFinder.CostMatrix;
				Log.debug(`Creating empty cost matrix for ${ck}`, 'Matrix');
				proxy[key] = new PathFinder.CostMatrix;
			}
		}
		return target.get(ck).matrix;
		// if (target[key] == null || Game.time - target[key].tick > this.maxAge) {
			// let start = Game.cpu.getUsed();
			
			// Log.debug(`Creating cost matrix for ${key}: ${target[key].serialize()}`);
			// console.log('Matrix used: ' + _.round(Game.cpu.getUsed() - start, 3));
		// }
		// return target[key].matrix;
	}

	set(target, key, value, proxy) {
		// console.log('Saving logistics matrix: ' + key);
		var ck = `${this.clazz.name}_${key}`;
		Log.debug(`Saving cost matrix for ${ck}`, 'Matrix');
		return target.set(ck, { matrix: value, tick: Game.time });
	}
} */
// @todo kill proxies
// @todo handle volatile data
/* eslint-enable class-methods-use-this */
// global.LOGISTICS_MATRIX = new Proxy(CostMatrix.cache, new LazyMatrixStore(LogisticsMatrix));
// global.FIXED_OBSTACLE_MATRIX = new Proxy(CostMatrix.cache, new LazyMatrixStore(FixedObstacleMatrix, 30));

global.LOGISTICS_MATRIX = new DelegatingLazyMap(
	(roomName) => (Game.rooms[roomName] && new LogisticsMatrix(roomName)) || new CostMatrix,
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
);

// map.get(roomname) has no idea about whether the item exists or if there will be an error.
// we can't throw an error this way.
global.LOGISTICS_MATRIX = new DelegatingLazyMap(
	(roomName) => {
		try {
			return (new LogisticsMatrix(roomName));
		} catch (e) {
			// Log.error(e.stack);
		}
		return new CostMatrix;
	},
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
);

/* global.FIXED_OBSTACLE_MATRIX = new LazyMap(
	(roomName) => (Game.rooms[roomName] && new CostMatrix).setFixedObstacles(Game.rooms[roomName]) || new CostMatrix,
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
); */

global.FIXED_OBSTACLE_MATRIX = new DelegatingLazyMap(
	(roomName) => {
		try {
			if (Game.rooms[roomName])
				return new FixedObstacleMatrix(roomName);
		} catch (e) {
			Log.error(e.stack);
		}
		return new CostMatrix;
	},
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
);

module.exports = {
	CostMatrix: CostMatrix,			// base class
	FixedObstacleMatrix: FixedObstacleMatrix,
	LogisticsMatrix: LogisticsMatrix,
};