/** Creep body array helper */
'use strict';

import BaseArray from './BaseArray';
import { RLD } from '/lib/util';

/**
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
 * Unit.Body.from([WORK,CARRY,MOVE])
 */
export default class Body extends BaseArray {
	static rld(arr) {
		const body = RLD(arr);
		if (body.length >= MAX_CREEP_SIZE)
			throw new Error(`Creep body is limited to ${MAX_CREEP_SIZE} parts`);
		return Object.setPrototypeOf(body, Body.prototype);
	}

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

	static get [Symbol.species]() { return Array; }
}