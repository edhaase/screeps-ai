/** Creep body array helper */
'use strict';

/**
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
 * Unit.Body.from([WORK,CARRY,MOVE])
 */
class Body extends Array {
	/** override push to limit size */
	push(part) {
		if (this.length >= MAX_CREEP_SIZE)
			throw new Error(`Creep body is limited to ${MAX_CREEP_SIZE} parts`);
		return super.push(part);
	}

	/** override fill to limit size */
	fill(value, start = 0, end = this.length) {
		return super.fill(value, start, Math.min(MAX_CREEP_SIZE, end));
	}

	/** override unshift to limit size */
	unshift(...args) {
		if ((args.length + this.length) > MAX_CREEP_SIZE)
			throw new Error(`Creep body is limited to ${MAX_CREEP_SIZE} parts`);
		return super.unshift.apply(this, args);
	}

	concat(...args) {
		return super.concat.apply(this, args);
	}

	/** Body specific stuff */
	cost() {
		return _.sum(this, p => BODYPART_COST[p]);
	}

	ticks() {
		return this.length * CREEP_SPAWN_TIME;
	}

	getCounts() {
		return _.countBy(this);
	}

	cycle(n) {
		var arr = [];
		for (var i = 0; i < n; i++)
			arr.push(this[i % this.length]);
		return arr;
	}

	repeat(maxCost, maxSize = MAX_CREEP_SIZE) {
		var n = Math.min(maxSize / this.length, maxCost / UNIT_COST(this));
		n = Math.floor(n);
		return this.cycle(this.length * n);
	}
}

module.exports = Body;