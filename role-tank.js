/*
 * ROLE-TANK
 *  doesn't attack, just heals 
 */ 
'use strict';

module.exports = function(creep) {
	var site = creep.memory.site;
	if ( !site ) return;
	
	var flag = Game.flags[site];
	
	creep.moveTo(flag);
	creep.heal(creep);
}