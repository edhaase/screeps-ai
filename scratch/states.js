'use strict';

Creep.prototype.runCombat = function (opts) {
	/** act like a soldier */
};

/**
 * States and transitions loosely based on existing creep methods
 */

/** Attack or dismantle target */
Creep.prototype.runMeleeCombat = function ({ tid }) {
	// @todo check hits
	const target = Game.getObjectById(tid);
	switch (this.attack(target)) {
		case ERR_INVALID_TARGET:
			this.popState();
			break;
		case ERR_NOT_IN_RANGE:
			this.moveTo(tid, { range: 1 });
			break;
		case ERR_NO_BODYPART:
		// @todo check safemode
	}
};

/** Portable guard logic. Kites, snipes, heals self */
Creep.prototype.runRangedCombat = function ({ tid }) {
	// @todo check hits
	// @todo kite
	this.heal(this);
	const target = Game.getObjectById(tid);
	switch (this.rangedAttack(target)) {
		case ERR_INVALID_TARGET:
			this.popState();
			break;
		case ERR_NOT_IN_RANGE:
			this.moveTo(tid, { range: CREEP_RANGED_ATTACK_RANGE });
			break;
		case ERR_NO_BODYPART:
		// @todo check safemode	
	}
};

// Running, speicifically, mass attack and ranged heal doesn't make that much sense.

// Specific target or everybody?
Creep.prototype.runHeal = function ({ tid }) {
	const target = Game.getObjectById(tid);
	if (target.hitPct >= 1.0)
		return this.popState();
	switch (this.heal(target)) {
		case ERR_INVALID_TARGET:
			this.popState();
			break;
		case ERR_NOT_IN_RANGE:
			this.moveTo(tid, { range: CREEP_RANGED_ATTACK_RANGE });
			break;
		case ERR_NO_BODYPART:
		// @todo check safemode	
	}
};

Creep.prototype.runRepair = function (opts) {
	// @todo check hits
	if (this.carry[RESOURCE_ENERGY] <= 0) {
		// Gather or harvest. Maybe random. Maybe not.
		return;
	}
	// @todo repair target, or repair all?
};

Creep.prototype.runBuild = function ({ structureType, pos }) {
	// @todo place site if need be
	// @todo move in range
	// @todo don't stand on obstacles
	// @todo 
	if (this.carry[RESOURCE_ENERGY] <= 0) {
		// Gather or harvest. Maybe random. Maybe not.
		return;
	}
};

Creep.prototype.runClaimController = function ({ pos }) {
	// @todo check hits
	if (!this.pos.isNearTo(pos))
		return this.moveTo(pos, { range: 1 });

	const { controller } = this.room;
	if (controller.reservation && Player.status(controller.reservation.username) === PLAYER_HOSTILE)
		return this.attackController(controller);
	if (controller.owner && Player.status(controller.owner.username) === PLAYER_HOSTILE)
		return this.attackController(controller);
	this.claimController(controller);
	this.popState();
};

Creep.prototype.runReserveController = function (opts) {
	// @todo attack controller
};

Creep.prototype.runAttackController = function (opts) {

};

