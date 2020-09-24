/**
 * @module
 */
import BaseArray from './BaseArray';
import { RLD } from '/lib/util';

/**
 * @class
 * @classdesc Creep body array helper
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
 * @example Body.from([WORK,CARRY,MOVE])
 */
export default class Body extends BaseArray {
	static rld(arr) {
		const body = RLD(arr);
		if (body.length >= MAX_CREEP_SIZE)
			throw new Error(`Creep body is limited to ${MAX_CREEP_SIZE} parts`);
		return Object.setPrototypeOf(body, Body.prototype);
	}

	/**
	 * Add a part to this body array
	 * @param {*} part 
	 */
	push(part) {
		if (this.length >= MAX_CREEP_SIZE)
			throw new Error(`Creep body is limited to ${MAX_CREEP_SIZE} parts`);
		return super.push(part);
	}

	/**
	 * 
	 * @param {*} value 
	 * @param {*} start 
	 * @param {*} end 
	 */
	fill(value, start = 0, end = this.length) {
		return super.fill(value, start, Math.min(MAX_CREEP_SIZE, end));
	}

	/**
	 * 
	 * @param  {...any} args 
	 */
	unshift(...args) {
		if ((args.length + this.length) > MAX_CREEP_SIZE)
			throw new Error(`Creep body is limited to ${MAX_CREEP_SIZE} parts`);
		return super.unshift.apply(this, args);
	}

	/**
	 * 
	 * @param  {...any} args 
	 */
	concat(...args) {
		return super.concat.apply(this, args);
	}

	/**
	 * 
	 */
	cost() {
		return _.sum(this, p => BODYPART_COST[p]);
	}

	/**
	 * 
	 */
	ticks() {
		return this.length * CREEP_SPAWN_TIME;
	}

	/**
	 * 
	 */
	getCounts() {
		return _.countBy(this);
	}

	static get [Symbol.species]() { return Array; }
}