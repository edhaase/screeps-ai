/**
 * Mining.js
 *
 * Handles the basics of mining operations
 * 
 * @TODO: Game.getObjectById doesn't work for remote objects, has to visible, so we need to store room positions instead of source ids.
 * @TODO: Allow colored flag for remote mining outputs, rather than a command based or manual memory edit.
 * @TODO: Prioritize closest mining sites, but account for multiple spawns.
 * @TODO: Mining sites need to have a threat level, to avoid the source keeper
 * @TODO: Account for ticks to regeneration (workers don't need to be waiting if there is something else they can do).
 * @TODO: Divide available energy across required miners/sites. Bigger creeps are nice, but keep the economy from collapsing.
 * Memory at Memory.mining
 *
 * Notes:
 *   200 ticks at 5 work to fill container (10 energy/tick)
 *   300 ticks at 5 work to mine source (10 energy/tick)
 */
'use strict';

const MinerBody = Util.RLD([Math.ceil(SOURCE_HARVEST_PARTS),1,MOVE])
 
global.MINING_BODIES = [
	// [WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE],
	[WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE],
	[WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE],
	[WORK,WORK,WORK,WORK,WORK,MOVE],
	[WORK,WORK,MOVE]	
];

global.REMOTE_MINING_BODIES = [
	// [WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE],
	[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE],
	[WORK,WORK,WORK,WORK,WORK,MOVE,MOVE]
];

global.UNIT_COST = (body) => _.sum(body, p => BODYPART_COST[p]);
global.MAX_MINING_BODY = (amt) => _.find(MINING_BODIES, b => UNIT_COST(b) <= amt);

module.exports = {		
	/**
	 * Request miner
	 */
	requestRemoteMiner: function(spawn, pos, expire=DEFAULT_SPAWN_JOB_EXPIRE) {
		// build the biggest one we can.
		
		/* var body = (spawn.room.energyCapacityAvailable >= 800)
				 ? [WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE]
				 : [WORK,WORK,WORK,WORK,WORK,MOVE,MOVE] ; */
		let body = _.find(REMOTE_MINING_BODIES, b => UNIT_COST(b) <= spawn.room.energyCapacityAvailable);
				 		
		// spawn.enqueue(body, null, {role:'miner', site: flagName}, 10);
		spawn.enqueue(body, null, {role:'miner', dest: pos, travelTime: 0}, 10, 0, 1, expire);
	},
	
	/**
	 * Request miner
	 */
	requestMiner: function(spawn, dest, prio=8) {
		// switch to constants!
		/* var body = (spawn.room.energyCapacityAvailable >= 550)
				 ? [WORK,WORK,WORK,WORK,WORK,MOVE]
				 : [WORK,WORK,MOVE] ; */
		/* let avail = spawn.room.energyCapacityAvailable;
		let body = [WORK,WORK,MOVE];
		if(avail >= 550)
			body = [WORK,WORK,WORK,WORK,WORK,MOVE];
		if(avail >= 650)
			body = [WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE]; */
		let body = _.find(MINING_BODIES, b => UNIT_COST(b) <= spawn.room.energyCapacityAvailable);
		// spawn.enqueue(body, null, {role:'miner', site: flagName}, 10);
		spawn.enqueue(body, null, {role:'miner', dest: dest, home: dest.roomName, travelTime: 0}, prio, 0, 1, DEFAULT_SPAWN_JOB_EXPIRE);
	},
	
	/* requestMineralMiner(spawn, flagName, expire=Infinity) {
		Log.warn('requestMineralMiner is deprecated');
		var body = Unit.repeat([WORK,WORK,MOVE], spawn.room.energyCapacityAvailable);
		body = Unit.sort(body);
		spawn.enqueue(body, null, {role: 'miner', site: flagName, travelTime: 0}, 10, 0, 1, expire);		
	}, */
	
	requestMineralHarvester(spawn, site, cid, expire) {
		var body = Unit.repeat([WORK,WORK,MOVE], spawn.room.energyCapacityAvailable);
		spawn.enqueue(body, null, {role: 'harvester', site: site, cid: cid}, 10, 0, 1, expire);
	},
	
	/**
	 * Request hauler
	 */
	requestHauler: function(spawn, flagName, hasRoad=false, role='hauler') {
		// Half as many move parts needed if we have road.
		var avail = spawn.room.energyAvailable;
		console.log("Available: " + avail);
		var body = [WORK,MOVE];
		// avail -= BODYPART_COST[WORK];
		while(Unit.cost(body) < avail) {
			body.push(MOVE);
			body.push(CARRY);
			if(hasRoad)
				body.push(CARRY);
		}
		console.log("Hauler body: " + JSON.stringify(body) + " ==> " + Unit.cost(body));
		spawn.enqueue(body, "H" + flagName, {role:'scav'});
	},
			
	flagSource: function(source) {
		 // var name = "M_" + source.id + "_" + tiles.length;
		var name = "M_" + source.id;
		 
		// console.log('Source ' + source.id + ' in room ' + source.room.name);
		var mine = _.get(source.room, 'controller.my', false);
		var status = (mine)?SITE_LOCAL:SITE_IDLE;
					
		if(source.room.controller && source.pos.inRangeTo(source.room.controller, 2))
			status = SITE_NEAR_RC;
		
		if(!Game.flags[name]) {
			console.log("New flag: " + name + " ==> " + source.pos);
			source.room.createFlag(source.pos, name, FLAG_MINING, status);
		} 
	},
	
	/**
	 * Flag new sites (optional assigned state)
	 */
	flagSites: function(roomName) {
		// Flag new sources
		if(roomName) {
			_.each(Game.rooms[roomName].find(FIND_SOURCES), s => this.flagSource(s));
		} else {
			_(Game.rooms)
			.invoke('find', FIND_SOURCES)
			.flatten()
			.each(function(source) {
				this.flagSource(source);
			}).commit();
		}
		
		// Replaced by StructureExtractor run behavior 
		/* _(Game.rooms)		
		.invoke('find', FIND_MINERALS)
		.flatten()
		.filter(ex => ex.my || ex.owner === undefined)
		.each(ex => ex.pos.createFlag("M_" + ex.id, FLAG_MINING, SITE_MINERAL))
		.commit(); */
	},
	
	/**
	 * Remove existing sites
	 */
	clearSites: function(confirm=false) {
		if(!confirm) {
			console.log("Clear sites requires confirmation");
			throw "This function requires confirmation";
		}
		return _(Game.flags)
				.filter({color: FLAG_MINING})
				.invoke('remove');
	},
	
	/**
	 *
	 */
	clearSitesInRoom: function(roomName, confirm=false) {
		if(!confirm)
			throw "This function requires confirmation";
		/* return _.filter(Game.flags, function(flag) {
			return flag.color == FLAG_MINING && flag.pos.roomName == roomName;
		}).invoke('remove'); */
		return this.getMiningFlagsInRoom(roomName).invoke('remove').commit();
	},
	 
	 disable: function() {
		Memory.mining.enabled = false; 
	 },
	 
	 enableRemotes: function() {
		_.set(Memory, 'mining.remotes', true);
	 },
	 
	 enable: function() {
		_.set(Memory, 'mining.enabled', true);
		_.set(Memory, 'mining.marker', Game.time);
		// Memory.mining.enabled = true; 
		// Memory.mining.marker = Game.time;
	 },
	 
	 isRemoteEnabled: function() {
		return _.get(Memory, 'mining.remotes', false);	    
	 },
	 
	 isEnabled: function() {
	    if(!Memory.mining || Memory.mining.enabled == false)
	        return false;
        return true;
	 },
	 
	 reset: function(confirm=false) {
		if(!confirm)
			return "This function requires confirmation";
		this.clearSites(confirm);
		Memory.mining = {
			enabled: false,
		};
		this.flagSites();
	 }
	 
}
 