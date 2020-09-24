/** os.prog.remotes.js */
'use strict';

/* global Log, MAX_CREEP_SPAWN_TIME, MINIMUM_RESERVATION, MAX_HAULER_STEPS */

import { runCensus } from '/lib/util';
import { VisibilityError } from '/os/core/errors';
import * as Co from '/os/core/co';
import Process from '/os/core/process';
import ThreadPoolExecutor from '/os/core/executor/threadpoolexecutor';
import reserver from '/role/economy/reserver';
import { PLAYER_STATUS } from '/Player';
import { ICON_SATELLITE } from '/lib/icons';

const MAX_REMOTE_SOURCES = Infinity;	// Might as well have a limit.
const RESERVATION_STEAL_MARGIN = 200;	// Give a player time to reclaim their remote
const HIGHLIGHT_RADIUS = 1;
const MAX_SPAWN_DIST_COST = Math.min(CREEP_LIFE_TIME, CREEP_CLAIM_LIFE_TIME);
const MINIMUM_RESERVER_COST = reserver.minCost;
const DEFAULT_DEFERRAL = 500;
const DEFAULT_REFRESH_DURATION = 300;

const REFRESH_POLL_RATE = 5;

/**
 * Replaces the remote mining flags that have never worked well.
 * 
 * Pieces:
 *  Asset management: Spawn miners, haulers (attempt to pair up spawning).
 *  Infrastructure: (Optional) build roads from sources to dropoff, repair only neccesary roads.
 *  Defense: Spawns defenders, tracks invaders, estimates next attack. 
 *  Reservation: Reserve remotes to improve income
 *  Scoring: Income vs expense (defense, infrastructure, distance) Prioritize more efficient rooms?
 * 
 * Notes:
 *  If we don't have room visibility we should scout it out or send a defender, try to use last room state.
 *  If the room has an owner we aren't remote mining it, remove those sources.
 *  If canMine is false (i.e somebody has reservation), deal with accordingly.
 *  Store capacity in memory for reference, reuse for hauler and miner sizing.
 *  Be aware of SK rooms.
 *  In debug mode, draw visuals of what we're working on.
 *  Find spawns within MAX_SPAWN_DIST_COST
 *  We can't (and don't need to) reserve SK rooms. 
 * 
 *  At 10 e/t mined and container capacity of 2000 we need to pick up every 200 ticks (including walking time)
 * 
 *  Constants: CARRY_PARTS, MAX_HAULER_STEPS
 * 
 * Source record: Not an actual source
 * {
 *   pos, id, energyCapacity
 *   refresh (tick),
 *   spawn (name),
 *   dest (pos), pickup (pos)
 * }
 */
export default class RemoteProc extends Process {
	constructor(opts) {
		super(opts);
		this.title = 'Remote mining';
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;

		this.pool_refresh = new ThreadPoolExecutor(this, this.refresh, {
			debugging: opts.debugging,
			max_idle: REFRESH_POLL_RATE + 1
		});

		this.activeSources = 0;
		this.activeSourceRooms = 0;
		this.activeSpawnRooms = 0;

		this.sourceRooms = {};	// rooms containing tracked sources
		this.dropoffRooms = {};	// rooms receiving resources
		this.spawnRooms = {};	// rooms spawning our creeps

		global.SR = () => this.shutdown();
	}

	get max_remotes() {
		return this.memory.max_remotes || MAX_REMOTE_SOURCES;
	}

	/**
	 * Add a source to be mined
	 */
	insert({ pos, id, energyCapacity }, enqueue = true) {
		const source = { pos, id, energyCapacity }; // separate out the game object
		this.memory.sources[id] = source;

		if (!this.sourceRooms[pos.roomName])
			this.sourceRooms[pos.roomName] = [];
		this.sourceRooms[pos.roomName].push(source);

		if (enqueue)
			this.pool_refresh.submit(source);
	}

	evict(source) {
		if (Array.isArray(source))
			source.forEach(s => this.evict(s));
		else
			delete this.memory.sources[source.id];
	}

	defer(source, ticks = DEFAULT_DEFERRAL) {
		if (Array.isArray(source))
			source.forEach(s => this.defer(s));
		else
			source.defer = Game.time + ticks;
	}


	/**
	 * Sort sources by distance, then group by room as reservation overhead and road infrastructure
	 * will benefit from less travel and spawn time.
	 * 
	 * Number of concurrent mines being supported should be equal to number of spawns rooms
	 */
	*run() {
		if (this.debugging)
			this.debug(`Process launched in debug mode`);

		// this.startThread(Co.forever, [this.investigate, 5], undefined, 'Investigator');
		// this.startThread(this.investigate, undefined, undefined, 'Investigator');
		const sources = _.filter(this.memory.sources, 'refresh');
		this.sourceRooms = _.groupBy(sources, 'pos.roomName');
		this.dropoffRooms = _.groupBy(sources, 'dest');
		this.spawnRooms = _.groupBy(sources, 'spawnRoom');

		for (const roomName of Object.keys(this.spawnRooms)) {
			if (roomName == null)
				continue;
			this.debug(`Resuming mining operations supported by ${roomName}`);
			this.startThread(this.spawner, [roomName]);
		}

		while (true) {
			yield this.sleepThread(REFRESH_POLL_RATE);
			if (_.isEmpty(Game.spawns)) {
				this.title = 'Idle (No spawns)';
				continue;
			}
			this.title = `Remote mining (${this.active} sources)`;
			for (const [id, source] of Object.entries(this.memory.sources)) {
				if (source.refresh && source.refresh > Game.time)
					continue;
				this.pool_refresh.submit(source);
			}
		}
	}

	/**
	 * Worker coroutine, called by thread pool.
	 */
	/* eslint-disable require-yield */
	*refresh(source) {
		const spawn = Game.spawns[source.spawn];
		if (spawn && !spawn.isDefunct() && source.refresh && source.refresh > Game.time)
			return; // Not actually needing to run
		const spawns = _.reject(Game.spawns, s => s.isDefunct());

		source.refresh = Game.time + DEFAULT_REFRESH_DURATION;
		const pos = new RoomPosition(source.pos.x, source.pos.y, source.pos.roomName);

		/**
		 * Refresh our records
		 */
		const room = Game.rooms[pos.roomName];
		const visual = new RoomVisual(pos.roomName);
		visual.circle(pos, { fill: 'red', radius: HIGHLIGHT_RADIUS, lineStyle: 'dashed' });

		if (room) {
			const [actual] = pos.lookFor(LOOK_SOURCES);
			source.capacity = (actual && actual.energyCapacity) || SOURCE_ENERGY_CAPACITY;
			this.debug(`Storing capacity ${source.capacity} for source ${source.id} at ${pos}`);
		}

		// controller containers are technically their own pathable things, and may not be closer than the controller itself given room terrain.
		// range here should be adjusted for type (controller range 3), and containers should be candidates with range 1
		// however range 3 for a hauler could be the wrong side entirely, or not even in the same room if the controller is near an edge.				 
		const destinations = Game.remoteDestinations || _.filter(Game.structures, s => [STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_CONTROLLER].includes(s.structureType) && s.my && s.isActive());
		Game.remoteDestinations = destinations; // Cache for a tick

		/**
		 * Refresh stored spawn
		 */
		const newSpawn = pos.findClosestByPathFinder(spawns, (s) => ({ pos: s.pos, range: 1 }), {
			plainCost: 1,
			maxCost: Math.min(MAX_SPAWN_DIST_COST, MAX_HAULER_STEPS(1, source.capacity || SOURCE_ENERGY_CAPACITY))
		});
		if (!newSpawn.goal) {
			this.warn(`No spawn for source ${pos}, evicting`);
			this.evict(source);
		} else {
			// Fix this when my brain isn't  fucked
			this.info(`Found spawn ${newSpawn.goal} [${newSpawn.goal.pos.roomName}] for source ${pos}`);
			if (source.spawn && source.spawn !== newSpawn.goal.name)
				delete this.spawnRooms[source.spawn][source.id];
			source.spawn = newSpawn.goal.name;
			source.spawnRoom = newSpawn.goal.pos.roomName;
			if (!this.spawnRooms[source.spawnRoom]) {
				this.spawnRooms[source.spawnRoom] = [];
				this.debug(`Starting mining operations supported by ${source.spawnRoom}`);
				this.startThread(this.spawner, [source.spawnRoom]);
			}
			this.spawnRooms[source.spawnRoom].push(source);
			// @todo launch thread
			[source.pickup] = newSpawn.path;
		}

		/**
		 * Refresh delivery destination
		 */
		const newDestination = pos.findClosestByPathFinder(destinations, s => ({ pos: s.pos, range: 1 }), {
			maxCost: MAX_HAULER_STEPS(1, this.memory.capacity || SOURCE_ENERGY_CAPACITY) /* only consider things we could still make an income off of */
		});
		if (newDestination.goal) {
			source.dropoff = newDestination.goal.pos;
			source.range = 1;
			source.cost = newDestination.cost;
			// copy over StructureController override
			this.info(`Found dropoff goal for ${pos}: ${newDestination.goal} ${source.dropoff} range ${source.range} (from ${pos}) at cost ${newDestination.cost} ops ${newDestination.ops} incomplete ${newDestination.incomplete}`);
		} else {
			this.error(`No dropoff for source ${pos}, evicting`);
			this.evict(source);
		}
	}

	/**
	 * This co/thread controls creep spawning for it's various remotes, builds a hauler
	 * pool for each supporting room
	 * 
	 * @param {String} roomName - Name of room spawning
	 */
	*spawner(spawnRoom) {
		if (spawnRoom == null)
			throw new Error(`Expected parameter`);
		this.debug(`Thread starting for ${spawnRoom}`);
		while (true) {
			yield this.sleepThread(REFRESH_POLL_RATE); // May want to sleep longer.	
			const sources = this.spawnRooms[spawnRoom];
			if (!sources || !sources.length)
				return; // No work to do, stop running
			const supporting = _.groupBy(sources, 'pos.roomName');
			this.setThreadTitle(`Room ${spawnRoom} supporting ${Object.keys(supporting)}`);
			if (_.all(sources, s => s.defer > Game.time))	// Busy
				continue;
			const recon = startService('recon');
			for (const [roomName, sources] of Object.entries(supporting)) {
				const sourceRoom = yield recon.request(roomName); // Don't procede until we can see the room
				yield* this.mineRoom(spawnRoom, sourceRoom, sources);
			}
		}
	}

	/**
	 * Focus on one specific room at a time
	 */
	*mineRoom(spawnRoom, sourceRoom, sources) {
		this.setThreadTitle(`Room ${spawnRoom} working on ${sourceRoom}`);
		const { controller, visual } = sourceRoom;
		if (this.debugging && controller)
			visual.circle(controller.pos, { fill: 'red', radius: HIGHLIGHT_RADIUS, lineStyle: 'dashed' });
		if (controller) {
			// if the controller has any owner, remove all sources,
			// we're not remote mining our owned rooms either.
			if (controller.owner) {
				this.warn(`Controller ${controller.pos} owned by ${JSON.stringify(controller.owner)}, removing sources`);
				this.evict(sources);
				return;
			} else if (controller.reservation && Player.status(controller.reservation.username) >= PLAYER_STATUS.TRUSTED && controller.reservation.username !== WHOAMI) {
				this.warn(`Controller ${controller.pos} reserved by friendly player ${controller.reservation.username}, deferring operation in this room`);
				this.defer(sources, (controller.reservation.ticksToEnd || 0) + RESERVATION_STEAL_MARGIN);
				return;
			}
			// if the controller is reserved by a hostile, attack it.
			// if the controller is reserved by a friendly, defer the room.		
		}
		if (Memory.routing && Memory.routing.avoid && Memory.routing.avoid.includes(this.pos.roomName)) {
			this.warn(`${sourceRoom.name}: Routing disabled for this room, won't be able to reach`);
			this.evict(sources);
			return;
		}
		// if no controller (sector center), just fight over the room?
		if (yield* this.defendRoom(sourceRoom))
			return;			
		// Can only reserve a room if it has a controller.
		yield* this.reserveRoom(sourceRoom, spawnRoom); // May fail
		// Once the room reservation is taken care of, if it can, proceed
		// with mining the room. 
		//for (const source of sources)
		//	yield* this.mine(source);
	}

	/**
	 * Check if a room needs defending and spawn creeps if neccesary
	 * @param {Room} room 
	 * @returns {bool} true if room is waiting for defenders
	 */
	*defendRoom(room) {
		const { hostiles } = room;
		const core = room.findOne(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } });
		if (!core && (!hostiles || !hostiles.length))
			return false;
		/* if (!_.isEmpty(hostiles)) {
			// @todo 1 or more, guard body based on enemy body and boost.
			const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
			const unit = this.getAssignedUnit(c => c.getRole() === 'guard' && c.memory.site === this.name && (c.spawning || c.ticksToLive > UNIT_BUILD_TIME(c.body) + cost));
			if (unit || !spawn)
				return this.defer(MAX_CREEP_SPAWN_TIME);
			// @todo Find correct guard to respond.
			Log.warn(`Requesting guard to ${this.pos}`, "Flag");
			requestGuard(spawn, this.name, this.pos.roomName);
			return this.defer(DEFAULT_SPAWN_JOB_EXPIRE);
		} else if (core) {
			const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
			const unit = this.getAssignedUnit(c => c.getRole() === 'attack' && c.memory.dest === this.pos.roomName && (c.spawning || c.ticksToLive > UNIT_BUILD_TIME(c.body) + cost));
			if (unit || !spawn)
				return this.defer(MAX_CREEP_SPAWN_TIME);
			Log.warn(`Requesting attack bulldozer to ${this.pos}`, "Flag");
			spawn.submit({ memory: { role: 'attack', dest: this.pos.roomName } });
			return this.defer(DEFAULT_SPAWN_JOB_EXPIRE);
		}  */
		return true;
	}

	/**
	 * @todo needs controller position and step cost
	 * @todo needs check to see if we can reserve (may not have supporting room)
	 */
	*reserveRoom(roomName) {
		const cost = 0; // ?
		const clock = _.get(Memory.rooms, [roomName, 'reservation'], Game.time) - Game.time;
		if (clock > MINIMUM_RESERVATION)
			return;
		const size = Math.floor((CONTROLLER_RESERVE_MAX - clock) / (CONTROLLER_RESERVE * (CREEP_CLAIM_LIFE_TIME - cost)));
		// const reserver = this.getAssignedUnit(c => c.getRole() === 'reserver' && this.pos.isEqualToPlain(c.memory.site) && (c.spawning || (c.ticksToLive > (2 * size * CREEP_SPAWN_TIME) + cost)));
		//if (reserver)
		//	return;
		//this.setThreadTitle(`Spawning reserver for ${roomName}`);
		// @todo submit job
		// @todo wait until renewing starts

		// wait and see if spawning starts or proceed without?
		yield;
	}

	/**
	 * Perform neccesary operations to drive a single remote resource.
	 * 
	 * Couroutine runs until resource has all neccesary components
	 */
	*mine(source) {
		const { id, pos, dropoff, refresh } = source;
		// check for miner for available energy, spawn haulers.
		// check for miner, spawn miner, prespawn.
		yield* this.ensureMiners();
		yield* this.ensureHaulers();
		yield* this.ensureSwampRoad();
	}

	/**
	 * Process shutdown has been requested
	 */
	shutdown() {
		// Mark assets for recycling
		super.shutdown(); // Terminate process
	}

	/**
	 * Process startup behavior
	 */
	onStart() {
		this.warn(`New remote mining process on tick ${Game.time}`);
		this.memory.sources = {};
		for (const [name, flag] of Object.entries(Game.flags)) {
			// import flags in remote mining process
			if (flag.color !== FLAG_ECONOMY || flag.secondaryColor === SITE_PICKUP)
				continue;
			const [source] = flag.pos.lookFor(LOOK_SOURCES);
			if (source)
				this.insert(source, false);
		}
	}

	getAssignedUnit(fn) {
		// if(!_.isFunction(fn))
		//	throw new Exception('Expected function')
		const name = this.local.creep;
		let creep = Game.creeps[name];
		if (creep && fn(creep)) {
			return creep;
		} else {
			creep = _.find(Game.creeps, fn);
			this.local.creep = (creep) ? creep.name : undefined;
			return creep;
		}
	}
}