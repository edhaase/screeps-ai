/** /ds/set - Set extensions */
'use strict';

import * as Itr from '/os/core/itr';

export default class BaseSet extends Set {
	/** Take up to N items out and return them as an array */
	pull(n) {
		const items = [...Itr.take(this.values(), n)];
		for (const i of items)
			this.delete(i);
		return items;
	}
}