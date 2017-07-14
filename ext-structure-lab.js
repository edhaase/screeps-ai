/**
 * ext-structure-lab.js - Evil science
 *
 * Current iteration of this AI doesn't leave a lot of cpu for
 * running reactions, let alone for planning them or auto placing decent
 * lab setups. So for now we'll let our terminals purchase compounds
 * for us, labs can set a target resource to load/unload,
 * and then creeps can seek out boosts.
 *
 * For running reactions there's two ways to think about it:
 *
 * Build everything we can based on nearby labs, or build only
 * things we have a demand for or a task in some reaction queue.
 *
 * Either way due to the number of labs we get per room, the run logic
 * for lab code should be as efficient and quick as possible. Perhaps
 * labs will be "dumb", and the controller will make decisions for them
 * as a whole.
 *
 * See: http://support.screeps.com/hc/en-us/articles/207891075-Minerals
 * Boost amounts may be off.
 *
 *
 * @todo: Only load amounts rounded to nearest LAB_BOOST_MINERAL amount
 * @todo: Pick available compounds from the terminal with amount >= LAB_BOOST_MINERAL
 *
 * Game.getObjectById('57a197da07fd0503184b439e').getAvailReaction()
 */
'use strict'; 

// Boosting, reacting, slave?

/**
 * let [resA,resB] = RECIPES[compound];
 */
global.RECIPES = {};
for(var a in REACTIONS){
	for(var b in REACTIONS[a]){
		RECIPES[REACTIONS[a][b]] = [a,b];
	}
}
 
/**
 * Core logic for the lab structure. How does this lab structure
 * want to act to help the whole.
 */
StructureLab.prototype.run = function() {	
	if(this.cooldown > 0 || CPU_LIMITER)
		return;
	let {lab1, lab2} = Memory.structures[this.id] || {}; // this.memory;
	lab1 = Game.getObjectById(lab1);
	lab2 = Game.getObjectById(lab2);
	if(lab1 && lab2 && lab1.mineralAmount >= LAB_REACTION_AMOUNT && lab2.mineralAmount >= LAB_REACTION_AMOUNT)
		this.runReaction(lab1, lab2);
}

/**
 * Define boost as a persistent property on labs. Determines what mineral
 * we want loaded. Resource movers will resolve it. Other creeps can
 * find a lab with the correct compound or boost and seek it out.
 *
 * Note: This is more of a "demand" thing. Creeps will use the currently
 * loaded resource and amount.
 */
Object.defineProperty(StructureLab.prototype, 'boost', {
	set: function(value) {
		if(!(typeof value === 'string'))
			throw new Error('Expected string, got ' + value);
		this.memory.r = value;
	},
	get: function() {
		if(this === StructureLab.prototype)
			return null;
		// if(this.memory.r == undefined)
		//	this.memory.r = 0
		return this.memory.r;
	},
	configurable: true,
	enumerable: false
});

/** ------------ Old stuff ------------- */

StructureLab.prototype.runReactions = function() {
	
}

/**
 * Maximum number of parts we can boost at once. Currently this is 100,
 * or maximally two full creeps. As long it's >=1 I don't need logic for
 * waiting around.
 */
StructureLab.prototype.getMaxBoostPartCount = function() {
	return this.energyCapacity / LAB_BOOST_ENERGY;
}

const ROLE_UPGRADER = 'upgrader'; 
 
global.ROLE_BOOSTS = {
	[RESOURCE_GHODIUM_HYDRIDE]: [ROLE_UPGRADER],
	[RESOURCE_GHODIUM_ACID]: [ROLE_UPGRADER],
	[RESOURCE_CATALYZED_GHODIUM_ACID]: [ROLE_UPGRADER],	
}; 

StructureLab.prototype.boostAdjacent = function() {
	let roles = ROLE_BOOSTS[this.mineralType] || [];
	if(_.isEmpty(roles))
		return;
	let adj = _.map(this.lookForNear(LOOK_CREEPS, true), LOOK_CREEPS);
	let creep = _.find(adj, c => c.spawning == false
							&& c.ticksToLive > 500							
							&& roles.indexOf(c.memory.role) != -1
							&& !c.hasActiveBodypart(CLAIM)
							);
	if(!creep)
		return;	
	if(this.boostCreep(creep) === OK) {
		creep.say('\u265B', true);
		Log.info('[LAB] Boosting creep ' + creep.name + ' at ' + this.pos);
	}
}

global.LAB_REACTION_RANGE = 2;
StructureLab.prototype.highlightInRange = function() {
	let labs = this.pos.findInRange(FIND_MY_STRUCTURES, LAB_REACTION_RANGE, {filter: s => s.structureType === STRUCTURE_LAB && s.id != this.id});
	labs.forEach(l => this.room.visual.circle(l.pos, {fill: 'red', opacity: 1}));
	return labs;
}

StructureLab.prototype.findAdjacentLabs = function() {
	return _.filter(this.room.structuresByType[STRUCTURE_LAB], l => l.id != this.id && this.pos.inRangeTo(l.pos, 1));
}

// _.invoke(Game.rooms['E57S47'].structuresByType[STRUCTURE_LAB], 'storeAdjacentLabs')
StructureLab.prototype.storeAdjacentLabs = function() {
	let [lab1, lab2] = this.findAdjacentLabs();
	this.memory.lab1 = lab1.id;
	this.memory.lab2 = lab2.id;
}

/* StructureStorage.prototype.getAvailReaction = function() {
	let minerals = _.omit(this.store, 'energy');
	// _.each(REACTIONS, (i,keyA) => _.each(i, (j,keyB) => console.log(keyA+ " + "  + keyB)  ) );
} */

StructureLab.prototype.getAvailReaction = function() {
	// labs 1 and 2
	// findInRange(1-2)
}

/* let boostCreep = StructureLab.prototype.boostCreep;
StructureLab.prototype.boostCreep = function(c,b) {
	if(!c.my || Player.status(c.owner.username) == PLAYER_ALLY)
		return ERR_INVALID_TARGET;
	return boostCreep(c,b);
} */

/* let runReaction = StructureLab.prototype.runReaction;
StructureLab.prototype.runReaction = function(lab1, lab2) {
	return runReaction(lab1, lab2);
} */

