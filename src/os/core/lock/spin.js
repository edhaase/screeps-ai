/** /os/core/lock.spin.s - Locking mechanisms */
'use strict';

const spinlocks = {};

export function* spinlock(name, co) {
	while (spinlocks[name] && !(yield)) { /* spin spin spin */ }
	try {
		spinlocks[name] = true;
		return (yield* co);
	} finally {
		spinlocks[name] = undefined;
	}
};