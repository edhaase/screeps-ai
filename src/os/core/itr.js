/** os.itr.js - Iterator methods */
'use strict';

exports.first = function first(itr) {
	for (const itm of itr)	// In case it's not a generator..
		return itm;

};

exports.take = function* take(itr, n) {
	var remaining = n;
	for (const itm of itr) {
		if (remaining-- <= 0)
			break;
		yield itm;
	}
};

exports.min = function min(itr, fn = _.identity) {
	var x, v = Infinity;
	var n = null;
	for (const itm of itr) {
		x = fn(itm);
		if (x >= v)
			continue;
		v = x;
		n = itm;
	}
	return n;
};

exports.find = function find(itr, fn) {
	for (const itm of itr) {
		if (fn(itm))
			return itm;
	}
	return null;
};

exports.filter = function* filter(itr, fn) {
	for (const itm of itr) {
		if (fn(itm))
			yield itm;
	}
};

exports.compact = function* compact(itr, filter = _.identity) {
	yield* exports.filter(itr, (v) => v !== null && filter(v));
};

exports.sample = function* sample(items) {
	while (true)
		yield _.sample(items, 1);
};

exports.sum = function sum(itr, fn = _.identity) {
	var total = 0;
	for (const itm of itr)
		total += fn(itm);
	return total;
};

exports.flatten = function* flatten(itr) {
	for (const itm of itr)
		yield* itm;
};

exports.avg = function avg(itr, iter = _.identity) {
	var total = 0;
	var count = 0;
	for (const i of itr) {
		total += iter(i);
		count++;
	}
	return total / count;
};

exports.explore = function* explore(start, max_range = 30, opts = {}) {
	const seen = { [start]: 0 };
	const q = [start];
	for (const roomName of q) {
		const dist = seen[roomName] || 0;
		if (dist >= max_range)
			continue;
		if (opts.filter && !opts.filter(roomName))
			continue;
		yield [roomName, dist];
		const exits = _.values(Game.map.describeExits(roomName));
		for (const exit of exits) {
			if (!IS_SAME_ROOM_TYPE(roomName, exit))
				continue;
			if (seen[exit] !== undefined && dist + 1 >= seen[exit])
				continue;
			if (opts.roomCallback && !opts.roomCallback(exit, roomName))
				continue;
			seen[exit] = dist + 1;
			q.push(exit);
		}
	}
};