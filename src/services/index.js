import PROGRAMS from '/programs/index';

/**
 * Register available services
 */
const SERVICES = {
	'cron': PROGRAMS.cron,
	'expansion': PROGRAMS.expansion,
	'intel': PROGRAMS.intel,
	'intershard': PROGRAMS.intershard,
	'market': PROGRAMS.market,	
	'recon': PROGRAMS.recon,
	'spawn': PROGRAMS.spawn,
	'empire': PROGRAMS.empire
}

export default SERVICES;
global.SERVICES = SERVICES;

