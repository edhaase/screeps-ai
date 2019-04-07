/** os.algo.xorcrypt */
'use strict';

/* Appropriated from Semperrrabit */
exports.xorcrypt = function xorcrypt(str, key) {
	var ret = "";
	for (var i = 0; i < str.length; i++) {
		ret += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
	}
	return ret;
}