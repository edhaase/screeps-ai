/** /os/core/crypto */
'use strict';

import { xorcrypt } from '/algorithms/xorcrypt';
import { ENV } from '/os/core/macros';
import { Log, LOG_LEVEL } from '/os/core/Log';

/** Need to avoid range 0xD800-0xDFFF */

/* if (!Memory.env.crypto) {
	Log.warn(`Initializing crypto module`, 'Crypto');
	Memory.env.crypto = {};
} */

const SECRET_KEY = ENV('crypto.secret');

export function generateKey(length = 16) {
	var i, str = "";
	for (i = 0; i < length; i++) {
		str += String.fromCodePoint(Math.floor(Math.random() * 65535) & 0x3FFF );
	}
	return str;
};

export function encrypt(str, key = SECRET_KEY) {
	// String.fromCodePoint(Number.MAX_VALUE)
	return xorcrypt(str, key);
};

export function decrypt(str, key = SECRET_KEY) {
	return xorcrypt(str, key);
};

/** Requires the method to be exported to call it */
/* if (!Memory.env.crypto || !Memory.env.crypto.secret) {
	Log.warn(`Secret key missing, regenerating`, 'Crypto');
	Memory.env.crypto.secret = generateKey();
} */
