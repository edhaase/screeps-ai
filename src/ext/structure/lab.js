/**
 * ext.structure.lab.js - Evil science
 *
 * See: http://support.screeps.com/hc/en-us/articles/207891075-Minerals
 *
 * @todo: Only load amounts rounded to nearest LAB_BOOST_MINERAL amount
 */
'use strict';

global.LAB_REACTION_RANGE = 2;

/* global DEFINE_MEMORY_BACKED_PROPERTY, DEFINE_CACHED_GETTER */

/**
 * Define boost as a persistent property on labs. Determines what mineral
 * we want loaded. Resource movers will resolve it. Other creeps can
 * find a lab with the correct compound or boost and seek it out.
 *
 * Note: This is more of a "demand" thing. Creeps will use the currently
 * loaded resource and amount.
 */
DEFINE_MEMORY_BACKED_PROPERTY(StructureLab.prototype, 'boost');

DEFINE_CACHED_GETTER(StructureLab.prototype, 'maxParts', l => Math.floor(Math.min(l.energy / LAB_BOOST_ENERGY, l.mineralAmount / LAB_BOOST_MINERAL)));

StructureLab.prototype.MAX_PARTS_PER_BOOST_ACTION = Math.floor(Math.min(LAB_ENERGY_CAPACITY / LAB_BOOST_ENERGY, LAB_MINERAL_CAPACITY / LAB_BOOST_MINERAL));


/**
 * let [resA,resB] = RECIPES[compound];
 */
/* global RECIPES */
global.RECIPES = {};
for (const a in REACTIONS) {
	for (const b in REACTIONS[a]) {
		RECIPES[REACTIONS[a][b]] = [a, b];
	}
}

/* global BOOST_PARTS */
global.BOOST_PARTS = {};
for (const part in BOOSTS) {
	for (const compound in BOOSTS[part])
		BOOST_PARTS[compound] = part;
}

/* global BOOSTS_ALL */
global.BOOSTS_ALL = [];
for (const part in BOOSTS) {
	for (const compound in BOOSTS[part])
		BOOSTS_ALL.push(compound);
}

/**
 * Core logic for the lab structure. How does this lab structure
 * want to act to help the whole.
 */
/* StructureLab.prototype.run = function () {
	if(this.cooldown > 0 || CPU_LIMITER)
		return;
	let {lab1, lab2} = Memory.structures[this.id] || {}; // this.memory;
	lab1 = Game.getObjectById(lab1);
	lab2 = Game.getObjectById(lab2);
	if(lab1 && lab2 && lab1.mineralAmount >= LAB_REACTION_AMOUNT && lab2.mineralAmount >= LAB_REACTION_AMOUNT)
		this.runReaction(lab1, lab2); 
}; */
StructureLab.prototype.getNeighbors = function () {
	const structures = _.map(this.lookForNear(LOOK_STRUCTURES, true, LAB_REACTION_RANGE), LOOK_STRUCTURES);
	return _.filter(structures, s => s.structureType === STRUCTURE_LAB && s.id !== this.id);
};

const MIN_LAB_PROVIDERS = 2;
StructureLab.prototype.isReactionCapable = function () {
	const n = this.getNeighbors();
	return !!(n && n.length >= MIN_LAB_PROVIDERS);
};

const { runReaction, boostCreep } = StructureLab.prototype;

/* eslint-disable no-unused-vars */
StructureLab.prototype.runReaction = function (lab1, lab2) {
	if (this.busy)
		return ERR_BUSY;
	const status = runReaction.apply(this, arguments);
	if (status === OK) {
		this.busy = true;
	}
	return status;
};

StructureLab.prototype.boostCreep = function (creep, bodyPartsCount) {
	if (this.busy)
		return ERR_BUSY;
	const status = boostCreep.apply(this, arguments);
	if (status === OK)
		this.busy = true;
	return status;
};