/**
 * Util.js
 */
"use strict";

class Util {
	static invoke(collection, method, ...args) {
		var i,itm;
		for(i in collection) {
			itm = collection[i];
			if(!itm[method])
				continue;
			itm[method].apply(itm,args);
		}
	}

	// combine to bytes into single unicode byte
	static toUnicode(a, b) {
		a += 127;
		b += 127;
		return String.fromCharCode((a << 8) + b);
	}

	static fromUnicode(character) {
		const integer = character.charCodeAt(0);
		return [(integer >> 8) - 127, (integer & 255) - 127];
	}


	static formatNumber(number) {
		return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	// combine two 16 bit values into a single 32 bit
	static combine(a, b) {
		return (a << 16) + b;
	}

	static seperate(integer) {
		return [(integer >> 16), (integer & 0x0000FFFF)];
	}


	/**
	 *
	 */
	static format(number) {
		return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}

	/**
	 * Object.getOwnPropertyDescriptor(Creep.prototype, "memory").get.toString()
	 */
	static inspectGetter(prot, prop) {
		return Object.getOwnPropertyDescriptor(prot, prop).get.toString();
	}

	/**
	 * or _.find(array, s=> _.indexOf(secondArray, s) == -1)
	 */
	static firstThingNotInOtherArray(array, secondArray) {
		var result;
		for (var i = 0, l = array.length; i < l; i++) {
			if (secondArray.indexOf(array[i]) === -1) { result = array[i]; break; }
		}
		return result;
	}

	/**
	 * Average of collection
	 */
	static avg(collection, iter = _.identity) {
		var total = 0;
		var count = 0;
		_.each(collection, function (item) {
			total += iter(item);
			count++;
		});
		return total / count;
	}

	/**
	 * Shift items off the front of the array while
	 * predicate returns truthy.
	 */
	static shiftWhile(arr, fn, act) {
		if (!_.isArray(arr))
			throw new TypeError("Expected array");
		var item;
		while (arr.length && fn(arr[0])) {
			item = arr.shift();
			if (act)
				act(item);
		}
		return arr;
	}

	/** 
	 * Run-length encode an array
	 * @param [Number]
	 * @return [Number]
	 * ex: Time.measure( () => Util.RLE((new CostMatrix.CostMatrix()).serialize()) ) // 0.42 cpu
	 * ex: Time.measure( () => Util.RLE((new CostMatrix.CostMatrix()).serialize()) )
	 * ex: Time.measure( () => Util.RLE(Memory.rooms['E59S42'].cm.obstacle) ) // 0.05
	 */
	static RLE(arr) {
		if (!arr || !arr.length)
			throw new Error("RLE expects non-empty array");

		var r = [];
		var m = 0;
		var c = 1;

		for (var i = 1; i < arr.length; i++) {
			if (arr[i] === arr[i - 1])
				c++;
			else {
				r[m++] = c;
				r[m++] = arr[i - 1];
				c = 1;
			}
		}
		r[m++] = c;
		r[m++] = arr[i - 1];
		return r;
	}

	/** 
	 * Run-length decode an array
	 * @param [Number]
	 * @return [Number]
	 */
	static RLD(arr) {
		if (!arr || !arr.length)
			throw new Error("RLD expects non-empty array");
		var i, j, c, v, r = [];
		for (i = 0; i < arr.length; i += 2) {
			c = arr[i];
			v = arr[i + 1];
			for (j = 0; j < c; j++)
				r.push(v);
		}
		return r;
	}

	/**
	 * Do something with the memory stored in segment.
	 *
	 * @param number id - Memory segment number
	 * @param function fn 
	 */
	static withMemorySegment(id, fn) {
		if (id < 0 || id >= SEGMENT_MAX_COUNT)
			throw new Error('Id not in range');
		if (RawMemory.segments[id] === undefined)
			throw new Error('Segment not loaded');
		var obj;
		if (RawMemory.segments[id] === "")
			obj = {};
		else
			obj = JSON.parse(RawMemory.segments[id]);
		fn(obj);
		var tmp = JSON.stringify(obj);
		var len = tmp.length;
		if (len >= SEGMENT_MAX_SIZE)
			throw new Error('Segment would exceed size limit!');
		RawMemory.segments[id] = tmp;
		return len;
	}

	/**
	 * from Dissi!
	 */
	static getColorBasedOnPercentage(thePercentage) {
		var hue = Math.floor((100 - thePercentage) * 120 / 100);  // go from green to red
		var saturation = Math.abs(thePercentage - 50) / 50;
		return this.hsv2rgb(hue, saturation, 1);
	}

	// spedwards
	static getColourByPercentage(percentage, reverse) {
		const value = reverse ? percentage : 1 - percentage;
		const hue = (value * 120).toString(10);
		return `hsl(${hue}, 100%, 50%)`;
	}

	static getColorRange(max) {
		var colors = [];
		for (var i = 0; i < max; i++)
			colors.push(this.getColorBasedOnPercentage(100 * (i / max)));
		return colors;
	}

	/**
	 *
	 */
	static hsv2rgb(h, s, v) {
		// adapted from http://schinckel.net/2012/01/10/hsv-to-rgb-in-javascript/
		var rgb, i, data = [];
		if (s === 0) {
			rgb = [v, v, v];
		} else {
			h = h / 60;
			i = Math.floor(h);
			data = [v * (1 - s), v * (1 - s * (h - i)), v * (1 - s * (1 - (h - i)))];
			switch (i) {
			case 0:
				rgb = [v, data[2], data[0]];
				break;
			case 1:
				rgb = [data[1], v, data[0]];
				break;
			case 2:
				rgb = [data[0], v, data[2]];
				break;
			case 3:
				rgb = [data[0], data[1], v];
				break;
			case 4:
				rgb = [data[2], data[0], v];
				break;
			default:
				rgb = [v, data[0], data[1]];
				break;
			}
		}
		return '#' + rgb.map(function (x) {
			return ("0" + Math.round(x * 255).toString(16)).slice(-2);
		}).join('');
	}
}

module.exports = Util;