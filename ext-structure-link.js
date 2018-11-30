/**
 * ext-structurelink.js
 * 
 * Logic for operating links
 * @todo Improve error handling
 */
'use strict';

/* global DEFINE_CACHED_GETTER, Log */

const LINK_AUTOBALANCE_THRESHOLD = 100; // Amount of energy over in-network average before transferring.
const LINK_ON_ERROR_DEFER = 100;
const LINK_PRECISION = 100;

DEFINE_CACHED_GETTER(Room.prototype, 'links', function () {
	if (this.cache.links == null || Game.time - this.cache.tick > 10) {
		this.cache.links = this.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK }).map(s => s.id);
		this.cache.tick = Game.time;
	}
	return _.map(this.cache.links, l => Game.getObjectById(l));
});

DEFINE_CACHED_GETTER(Room.prototype, 'energyInNetwork', r => _.sum(r.links, 'energy'));
DEFINE_CACHED_GETTER(Room.prototype, 'energyCapacityInNetwork', r => _.sum(r.links, 'energyCapacity'));
DEFINE_CACHED_GETTER(Room.prototype, 'avgInNetwork', r => r.energyInNetwork / r.links.length);

StructureLink.prototype.run = function () {
	// var {cooldown,energy,pos,room,memory} = this;
	if (this.cooldown > 0 || (this.energy < LINK_AUTOBALANCE_THRESHOLD) || CPU_LIMITER || BUCKET_LIMITER)
		return;
	if (this.isDeferred() || (Game.time & 3))
		return;
	if (this.room.links.length <= 1) {
		this.defer(LINK_ON_ERROR_DEFER);
		return;
	}
	var { avgInNetwork } = this.room;
	const diff = LINK_PRECISION * Math.floor((this.energy - avgInNetwork) / LINK_PRECISION); // Round to nearest 100 to reduce ineffiency
	if (diff < LINK_AUTOBALANCE_THRESHOLD)
		return;
	var target = this.pos.findClosestByRange(this.room.links, { filter: t => t && t.energy < avgInNetwork && !t.isReceiving });
	if (!target)
		return;
	var amt = Math.clamp(0, Math.ceil(diff), LINK_CAPACITY - target.energy);
	if (amt <= 0)
		return;
	if (this.transferEnergy(target, amt) === OK) {
		var dist = this.pos.getRangeTo(target.pos);
		var ept = _.round(amt / dist, 3);
		Log.debug(`${this.pos} Moving ${amt} energy ${dist} units for ${ept} ept`, 'Link');
	}
};

/**
 * Link to link transfer enhancement. Denies transfer if destination already has incoming.
 */
const { transferEnergy } = StructureLink.prototype;
StructureLink.prototype.transferEnergy = function (target, amount) {
	/* eslint-disable indent */
	if (!target || !(target instanceof StructureLink)) {
		return ERR_INVALID_TARGET;
	}

	if (target.isReceiving || this.isSending)
		return ERR_BUSY;

	var status;
	switch ((status = transferEnergy.apply(this, arguments))) {
		case OK:
			target.isReceiving = true;
			this.isSending = true;
			break;
		case ERR_FULL:
			Log.warn(`Link at ${target.pos} full ${target.energy}/${amount}`, 'Link');
	}
	return status;
};