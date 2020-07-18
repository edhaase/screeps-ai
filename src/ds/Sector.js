/**
 * Extends region, but is limited to sector bounds
 */
import Region from './Region';

export class Sector extends Region {
	toString() {
		return `[Sector ${this.topLeftName} ${this.bottomRightName}]`;
	}
}
