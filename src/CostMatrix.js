/**
 * CostMatrix.js
 *
 * ES6 class support for cost matricies
 */
'use strict';

/* global ENV, Log, Player */
/* eslint-disable no-magic-numbers */

const Intel = require('Intel');
const DelegatingLazyMap = require('os.ds.dele.lazymap');
const LRU = require('os.ds.lru');
const { VisibilityError } = require('os.core.errors');

const COST_MATRIX_EXPIRATION = ENV('cm.cache_expire', 5);
const COST_MATRIX_CACHE_SIZE = ENV('cm.cache_size', 300);

const CostMatrix = require('os.ds.costmatrix.room');
const TILE_UNWALKABLE = 255;

/**
 * The fixed obstacle matrix stores a position of obstacles in the world
 * that don't change often. Walls, structures, etc.
 */
class FixedObstacleMatrix extends CostMatrix {
	constructor(roomName) {
		super(roomName);
		if (!_.isString(roomName))
			throw new TypeError("FixedObstacleMatrix expects roomName string");

		const room = Game.rooms[roomName];
		if (!room)
			return;
		// don't forget enemy non-public ramparts!		
		this.setRoads(room);
		this.setStructureType(room, STRUCTURE_CONTAINER, 1);
		this.setFixedObstacles(room);
		this.setDynamicObstacles(room);
		this.setSKLairs(room);
		this.setExitTiles(room, 5);
		this.setPortals(room);
	}
}

global.FixedObstacleMatrix = FixedObstacleMatrix;

class ConstructionSiteMatrix extends FixedObstacleMatrix {
	constructor(roomName) {
		super(roomName);
		this.addConstructionPlan();
	}
}

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
		super(roomName);

		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);

		if (room.controller) // @todo if not a wall..
			this.applyInRoomRadius((x, y) => this.set(x, y, 1), room.controller.pos, 3);
		this.setRoads(room);
		this.setStructureType(room, STRUCTURE_CONTAINER, 1);
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
 * 
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

global.LOGISTICS_MATRIX = new DelegatingLazyMap(
	(roomName) => {
		try {
			return (new LogisticsMatrix(roomName));
		} catch (e) {
			// @todo needs fixing
			// Log.error(e.stack);
		}
		return new PathFinder.CostMatrix;
	},
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
);

global.FIXED_OBSTACLE_MATRIX = new DelegatingLazyMap(
	(roomName) => {
		try {
			return new FixedObstacleMatrix(roomName);
		} catch (e) {
			Log.error(e.stack);
		}
		return new PathFinder.CostMatrix;
	},
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
);

global.CONSTRUCTION_MATRIX = new DelegatingLazyMap((roomName) => new ConstructionSiteMatrix(roomName), new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE }));

module.exports = {
	CostMatrix: CostMatrix,			// base class
	FixedObstacleMatrix: FixedObstacleMatrix,
	LogisticsMatrix: LogisticsMatrix,
};