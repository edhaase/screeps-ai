/**
 * ext-structurelink.js
 * 
 * Logic for operating links
 */
'use strict';

global.LINK_AUTOBALANCE_THRESHOLD = 100; // Amount of energy over in-network average before transferring.

global.BIT_LINK_RECEIVE_ONLY = (1 << 1);

defineCachedGetter(Room.prototype, 'links', r => r.structuresByType[STRUCTURE_LINK] || []);
defineCachedGetter(Room.prototype, 'energyInNetwork', r => _.sum(r.links, 'energy'));
defineCachedGetter(Room.prototype, 'energyCapacityInNetwork', r => _.sum(r.links, 'energyCapacity'));
defineCachedGetter(Room.prototype, 'avgInNetwork', r => r.energyInNetwork / r.links.length);

StructureLink.prototype.run = function () {
	// var {cooldown,energy,pos,room,memory} = this;
	if(this.cooldown > 0 || (this.energy < LINK_AUTOBALANCE_THRESHOLD) || CPU_LIMITER || BUCKET_LIMITER)
		return;	
	if(this.isDeferred() || (Game.time & 3))
		return;
	if(this.memory.bits & BIT_LINK_RECEIVE_ONLY)
		return;	
	if(this.room.links.length <= 1)
		return this.defer(100);	
	var avgInNetwork = this.room.avgInNetwork;
	var diff = Math.floor(this.energy - avgInNetwork);
	if( diff < LINK_AUTOBALANCE_THRESHOLD )
		return;	
	var target = this.pos.findClosestByRange( this.room.links, {filter: t => t.energy < avgInNetwork && !t.isReceiving});
	if(!target)
		return;	
	var amt = Math.clamp(0, Math.ceil(diff), LINK_CAPACITY - target.energy);
	if(amt <= 0)
		return;
	if(this.transferEnergy(target, amt) === OK) {					
		let dist = this.pos.getRangeTo(target.pos);
		let ept = _.round(amt / dist,3);				
		Log.debug(`${this.pos} Moving ${amt} energy ${dist} units for ${ept} ept`, 'Link');	
	}
}

/**
 * Link to link transfer enhancement. Denies transfer if destination
 * already has incoming.
 */
var te = StructureLink.prototype.transferEnergy;
StructureLink.prototype.transferEnergy = function(target, amount) {	
	if( !target || !(target instanceof StructureLink) ) {
		return ERR_INVALID_TARGET;		
	}
	
	if( target && target.isReceiving )
		return ERR_BUSY;
	
	var status;	
	switch( (status=te.apply(this, arguments)) ) {
		case OK:
			target.isReceiving = true;
			break;
		case ERR_FULL:
			Log.warn(`Link at ${target.pos} full ${target.energy}/${amount}`, 'Link')
	}
	return status;
}