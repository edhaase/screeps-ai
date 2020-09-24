/**
 * role.local.js - Manages local room resources
 */
'use strict';

/**
 * Manages critical infrastructure such as spawning and towers.
 * 
 * Take energy from storage or terminal first and fills the room. Always do this.
 * _Only_ do this if the room energy is low. Only time extensions are considered.
 * 
 * Only needs to fill spawn, extension, tower, and terminal to keep economy online
 * Can use AcquireEnergy. Can harvest.
 * 
 * ENTER: if room energy <max, tower low
 * EXIT: when these are all full.
 */
const STATE_EXT_FILL = 'F';

/**
 * Sticks resources away for later.
 * 
 * Gathers resources dropped on the ground or in containers and transfers to
 * storage or terminal or resource pile near controller. Minerals to terminal.
 */
const STATE_STOCKPILE = 'S';

/**
 * Balances storage/terminal
 * 
 * If storage is over stocked and room max rcl, transfer to terminal
 * If storage is under stocked and terminal can provide energy (has energy or available order and credits)
 * then transfer energy to storage
 * 
 * ENTER: Nothing else to do
 * EXIT: Another state becomes available
 */
const STATE_BALANCE = 'B';

/**
 * 
 */
const STATE_IDLE_FILL = 2;



/* eslint-disable consistent-return */
export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function () {
		// WCMM
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		this.memory.ignoreRoads = (this.plainSpeed === this.roadSpeed);
	},
	/* eslint-disable consistent-return, indent */
	run: function () {
		// If we're here we have state
		switch (this.memory.state) {
			case STATE_EXT_FILL: {

				// if(this.room.energyPct >= 1.0 && )
				break;
			}
			case STATE_BALANCE: {
				break;
			}
			case STATE_STOCKPILE: {
				break;
			}
			case STATE_IDLE_FILL: {
				break;
			}
			default:
		}
	}
};