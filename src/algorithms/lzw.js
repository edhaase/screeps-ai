/** Lzw.js - Courtesy of @proximo */
'use strict';

export default class Lzw {
	/**
	 * @param {String}
	 * @returns string
	 */
	static encode(s) {
		var i, dict = {};
		var data = (s + "").split("");
		var out = [];
		var currChar;
		var [phrase] = data;
		var code = 256;
		for (i = 1; i < data.length; i++) {
			currChar = data[i];
			if (dict[phrase + currChar] != null) {
				phrase += currChar;
			}
			else {
				out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
				dict[phrase + currChar] = code;
				code++;
				phrase = currChar;
			}
		}
		out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
		for (i = 0; i < out.length; i++) {
			out[i] = String.fromCharCode(out[i]);
		}
		return out.join("");
	}

	/**
	 *
	 */
	static decode(s) {
		var dict = {};
		var data = (s + "").split("");
		var [currChar] = data;
		var oldPhrase = currChar;
		var out = [currChar];
		var code = 256;
		var phrase;
		for (var i = 1; i < data.length; i++) {
			var currCode = data[i].charCodeAt(0);
			if (currCode < 256) {
				phrase = data[i];
			}
			else {
				phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
			}
			out.push(phrase);
			currChar = phrase.charAt(0);
			dict[code] = oldPhrase + currChar;
			code++;
			oldPhrase = phrase;
		}
		return out.join("");
	}
}

module.exports = Lzw;