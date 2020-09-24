/**
 * @module
 */
import Region from './Region';

/**
 * @classdesc Extends region, but is limited to sector bounds
 */
export class Sector extends Region {
	toString() {
		return `[Sector ${this.topLeftName} ${this.bottomRightName}]`;
	}
}
