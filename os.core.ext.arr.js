/** os.ext.arr.js - core prototype extensions */
'use strict';

/* eslint-disable no-magic-numbers */

Array.prototype.remove = function (item) {
	const i = this.indexOf(item);
	if (i !== -1)
		this.splice(i, 1);
};