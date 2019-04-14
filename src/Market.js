/** Market.js - Market code that doesn't fit anywhere else */
'use strict';

/* global Log, TERMINAL_TAX */

const Intel = require('Intel');

/* eslint-disable no-magic-numbers */
global.MARKET_ORDER_LIMIT = 50;
if (Memory.empire == null)
	Memory.empire = { credits: 0 };
/* eslint-enable no-magic-numbers */

module.exports = {
	/**
	 * Periodically update our market history and terminal allotments.
	 * @todo Include sender/recipient (recipient isn't always provided)
	 */
	updateMarket: function (freq = 5) {
		this.updateIncomingMarket(freq);
		this.updateOutgoingMarket(freq);
	},

	resyncEmpireCredits: function () {
		const creditsInUse = _.sum(Memory.structures, 'c');
		const creditsWeThinkWeHave = Memory.empire.credits;
		const creditsWeActuallyHave = Game.market.credits - creditsInUse;
		const diff = Math.abs(creditsWeThinkWeHave - creditsWeActuallyHave);
		if (diff <= 0)
			Log.notify(`Empire market adjustment reports that we are accurate!`);
		else
			Log.notify(`Empire market adjustment ${diff} credits skew (creditsWeThinkWeHave: ${creditsWeThinkWeHave}, creditsWeActuallyHave: ${creditsWeActuallyHave})`); // Did we lose a building?
		Memory.empire.credits = creditsWeActuallyHave;
	},

	/**
	 * Outgoing notifications
	 */
	updateOutgoingMarket: function (freq = 5) {
		var outgoing = Game.market.outgoingTransactions;
		var transaction, j, len, total, distance;
		const tax = Memory.empire.marketTax || TERMINAL_TAX;
		for (j = 0, len = outgoing.length; j < len; j++) {
			transaction = outgoing[j];
			if (Game.time - transaction.time > freq)
				break;
			// if (transaction.to && _.get(Game.rooms, transaction.to + '.controller.my', false) === true)
			if (transaction.to && Game.rooms[transaction.to] && Game.rooms[transaction.to].my === true)
				continue;
			var { from, to, resourceType, amount, order, recipient } = transaction;
			distance = Game.map.getRoomLinearDistance(from, to, true);
			if (order && order.price) {
				total = amount * order.price;
				Game.rooms[from].terminal.credits += (total * (1.0 - tax));
				Memory.empire.credits += (total * tax);
				Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${total} total`, 'Market');
			} else {
				Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType}`, 'Market');
			}
			if (recipient && recipient.username)
				this.updateRecipient(recipient.username, to, transaction);
		}
	},

	/**
	 * Incoming notifications
	 */
	updateIncomingMarket: function (freq = 5) {
		var incoming = Game.market.incomingTransactions;
		var transaction, i, len, total, distance, desc;
		for (i = 0, len = incoming.length; i < len; i++) {
			transaction = incoming[i];
			if (Game.time - transaction.time > freq)
				break;
			var { from, to, resourceType, amount, order, sender } = transaction;
			// if (transaction.from && _.get(Game.rooms, transaction.from + '.controller.my', false) === true)
			if (transaction.from && Game.rooms[transaction.from] && Game.rooms[transaction.from].my === true)
				continue;
			distance = Game.map.getRoomLinearDistance(transaction.from, transaction.to, true);
			// var price = (order.price) ? order.price : 'NA';
			desc = _.escape(transaction.description);
			if (order && order.price) {
				total = amount * order.price;
				Game.rooms[to].terminal.credits -= total;
				Log.info(`Inbound transaction to ${to} from ${from} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${total} total (${desc})`, 'Market');
			} else {
				Log.info(`Inbound transaction to ${to} from ${from} (dist: ${distance}): ${amount} ${resourceType} (${desc})`, 'Market');
			}
			if (sender && sender.username)
				this.updateSender(sender.username, from, transaction);
			// Game.notify("Transaction received: " + JSON.stringify(transaction,null,2));						
		}
	},

	updateSender: function (name, roomName, transaction) {
		Log.info(`Sender info: ${name} in ${roomName}`);
		Intel.setRoomOwner(roomName, name);
	},

	updateRecipient: function (name, roomName, transaction) {
		Log.info(`Recipient info: ${name} in ${roomName}`);
		Intel.setRoomOwner(roomName, name);
	}
};