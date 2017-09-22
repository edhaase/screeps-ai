/**
 * Zen - Screeps AI
 *
 * Type Help() on the console for a simple list of commands
 * Type Reset(true) to clear memory and reset state
 * 
 * You can use the profiler from the console:
 * Game.profiler.profile(ticks, [functionFilter]);
 * Game.profiler.stream(ticks, [functionFilter]);
 * Game.profiler.email(ticks, [functionFilter]);
 */
"use strict";

/** Module profiler -  */
function loadModule(name) {
	var start = Game.cpu.getUsed();
	try {
		var mod = require(name);
		var used = _.round(Game.cpu.getUsed() - start, 3);
		if (used > 10)
			console.log(`Module ${name} loaded in ${used}`);
		return mod;
	} catch (e) {
		console.log(e);
		console.log(e.stack);
		throw e;
	}
}

/**
 * Welcome to the ninth level of hell
 * 
 * Delay imports and requires if under low bucket.
 */
console.log(`New runtime: ${Game.time}`);
module.exports.loop = function () {
	if (Game.cpu.bucket < Game.cpu.tickLimit) {
		console.log(`Runtime holding: ${Game.cpu.bucket}/${Game.cpu.tickLimit}`);
		return;
	}

	var start = Game.cpu.getUsed();

	loadModule('global');

	/** Set up global modules - These are reachable from the console */
	global.Util = loadModule('Util');
	global.Log = loadModule('Log');
	global.CostMatrix = loadModule('CostMatrix');
	global.Cache = loadModule('Cache');
	global.Empire = loadModule('Empire');
	global.Scheduler = loadModule('Scheduler');
	global.Time = loadModule('Time');
	global.Player = loadModule('Player');
	global.Filter = loadModule('Filter');
	global.Route = loadModule('Route');
	global.FSM = loadModule('FSM');
	global.Command = loadModule('Command');
	global.Segment = require('Segment');
	global.Market = loadModule('Market');
	loadModule('fsm-screeps');
	Object.assign(global, loadModule('astar_tedivm'));

	/**
	 * Set up prototype extensions
	 * Warning: Unable to extend PathFinder.CostMatrix prototype directly
	 */
	loadModule('ext');
	loadModule('ext-roomobject');
	loadModule('ext-roomposition');
	loadModule('ext-flag');
	loadModule('ext-room');
	loadModule('ext-creep');
	loadModule('ext-creep-actor');
	loadModule('ext-creep-actor-rts');
	loadModule('ext-source');
	loadModule('ext-roomvisual');
	loadModule('ext-structure');
	loadModule('ext-structure-spawn');
	loadModule('ext-structure-tower');
	loadModule('ext-structure-storage');
	loadModule('ext-structure-link');
	loadModule('ext-structure-observer');
	loadModule('ext-structure-controller');
	loadModule('ext-structure-terminal');
	loadModule('ext-structure-lab');
	loadModule('ext-structure-nuker');
	loadModule('ext-structure-extractor');
	loadModule('ext-structure-rampart');
	loadModule('ext-structure-powerspawn');


	// Hot swap the loop when we're loaded
	module.exports.loop = function () {
		if (Game.cpu.bucket <= Game.cpu.tickLimit)
			return Log.notify("Bucket empty, skipping tick!", 60);
		if (Game.cpu.getUsed() > Game.cpu.limit)
			return Log.warn('Garbage collector ate our tick');
		global.Volatile = {};
		global.RESOURCE_THIS_TICK = RESOURCES_ALL[Game.time % RESOURCES_ALL.length];

		if (Game.cpu.bucket < BUCKET_LIMITER_LOWER && !BUCKET_LIMITER) {
			BUCKET_LIMITER = true;
			Log.notify('[WARNING] Bucket limiter engaged!');
		} else if (Game.cpu.bucket > BUCKET_LIMITER_UPPER && BUCKET_LIMITER) {
			// Log.warn('Bucket limiter disengaged!', 'Cpu');
			BUCKET_LIMITER = false;
		}

		// var dTGC = Time.measure( () => GC() );
		// console.log('GC took: ' + dTGC);
		GC(); // Down to about 0. - 0.23 per tick

		try {
			// processMessages();
			Segment.update();
			var dTR = Time.measure(() => _.invoke(Game.rooms, 'run'));
			var dTC = Time.measure(() => _.invoke(Game.creeps, 'run')); // Run MUST have try-catch				
			var dTS = Time.measure(() => _.invoke(Game.structures, 'logic'));
			var dTF = Time.measure(() => _.invoke(Game.flags, 'run'));
			var dEM = Time.measure(() => Empire.tick());
			// var dPL = Time.measure( () => Planner.tick() );
			var dCS = Time.measure(() => Command.tick());
			var dMS = Time.measure(() => _.invoke(SEGMENTS, 'commit'));
			if (!Memory.stats)
				Memory.stats = {};
			Memory.stats.runner = { dTR, dTS, dTC, dTF, dCS, dMS }; // , dTCS};
		} catch (e) {
			Log.error('Error in main loop: ' + e);
			Log.error(e.stack);
		}

		if (!(Game.time & 255)) {
			Log.success('Updating room builds', 'Planner');
			require('Planner').pushRoomUpdates();
			_(Game.market.orders).filter(o => o.remainingAmount <= 1).each(o => Game.market.cancelOrder(o.id)).commit();
			Time.updateTickLength(256);
		}

		if ((Game.time & 15) === 0) {
			Market.updateMarket(16); // Roughly .43  - .71 cpu??			
		}


		if (!Memory.stats)
			Memory.stats = {};
		updateCpuAvg('cpu10', 10);
		updateCpuAvg('cpu100', 100);
		updateCpuAvg('cpu1000', 1000);
		updateCpuAvg('cpu10000', 10000);

		Memory.stats['bucket100'] = Math.cmAvg(Game.cpu.bucket - (Memory.stats['bucket'] || 10000), Memory.stats['bucket100'], 100);
		Memory.stats['bucket'] = Game.cpu.bucket;
	};

	// Optional profiler
	if (false) {
		const profiler = loadModule('screeps-profiler');
		profiler.enable();
		profiler.registerObject(PathFinder.CostMatrix, 'pCostMatrix');
		profiler.registerClass(Empire, 'Empire');
		profiler.registerObject(Filter, 'Filter');
		// profiler.registerObject(OwnedStructure, 'OwnedStructure');
		profiler.registerObject(RoomObject, 'RoomObject');
		profiler.registerObject(StructureController, 'Controller');
		// profiler.registerObject(StructureExtension, 'Extension');
		// profiler.registerObject(StructureExtractor, 'Extractor');
		profiler.registerObject(StructureLab, 'Lab');
		profiler.registerObject(StructureLink, 'Link');
		profiler.registerObject(StructureNuker, 'Nuker');
		profiler.registerObject(StructureObserver, 'Observer');
		// profiler.registerObject(StructurePowerSpawn, 'PowerSpawn');
		profiler.registerObject(StructureRampart, 'Rampart');
		// profiler.registerObject(StructureStorage, 'Storage');
		profiler.registerObject(StructureTerminal, 'Terminal');
		profiler.registerObject(StructureTower, 'Tower');
		profiler.registerObject(RoomVisual, 'RoomVisual');
		profiler.registerObject(Structure, 'Structure');

		Log.info('Patching loop with profiler');
		const {loop} = module.exports;
		module.exports.loop = () => profiler.wrap(loop);
	}

	global.updateCpuAvg = function (key, samples) {
		Memory.stats[key] = Math.mmAvg(
			Math.ceil(Game.cpu.getUsed()),
			Memory.stats[key],
			samples
		);
	};
		
	var used = Game.cpu.getUsed() - start;
	console.log(`Delayed global reset (used ${used} cpu)`);
};

