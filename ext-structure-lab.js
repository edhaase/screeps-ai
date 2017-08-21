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

global.LAB_REACTION_RANGE = 2;

/**
 * let [resA,resB] = RECIPES[compound];
 */
/* global.RECIPES = {};
for(var a in REACTIONS){
	for(var b in REACTIONS[a]){
		RECIPES[REACTIONS[a][b]] = [a,b];
	}
} */
 
/**
 * Core logic for the lab structure. How does this lab structure
 * want to act to help the whole.
 */
StructureLab.prototype.run = function() {	
	/* if(this.cooldown > 0 || CPU_LIMITER)
		return;
	let {lab1, lab2} = Memory.structures[this.id] || {}; // this.memory;
	lab1 = Game.getObjectById(lab1);
	lab2 = Game.getObjectById(lab2);
	if(lab1 && lab2 && lab1.mineralAmount >= LAB_REACTION_AMOUNT && lab2.mineralAmount >= LAB_REACTION_AMOUNT)
		this.runReaction(lab1, lab2); */
}

/**
 * Define boost as a persistent property on labs. Determines what mineral
 * we want loaded. Resource movers will resolve it. Other creeps can
 * find a lab with the correct compound or boost and seek it out.
 *
 * Note: This is more of a "demand" thing. Creeps will use the currently
 * loaded resource and amount.
 */
/* Object.defineProperty(StructureLab.prototype, 'boost', {
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
}); */