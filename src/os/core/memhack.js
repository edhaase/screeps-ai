/** */
'use strict';


exports.wrap = function wrapLazyMemory(fn) {
	let memory, tick;
	return function () {
		if (tick && tick + 1 === Game.time && memory) {
			delete global.Memory;
			global.Memory = memory;
			RawMemory._parsed = memory;
		} else {
			memory = Memory;
		}
		tick = Game.time;
		fn();
	};
};