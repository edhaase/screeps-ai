/** Current experiments */

import TemplateVisual from '/visual/template';
global.TemplateVisual = TemplateVisual;

import templates from '/template/index';
global.templates = templates;

import Template from '/ds/Template';
global.Template = Template;

// import * as Planner from '/lib/planner';
// global.Planner = Planner;

import InfluenceMap from '/ds/InfluenceMap';
global.InfluenceMap = InfluenceMap;

import Future from '/os/core/future';
global.Future = Future;

import Route from '/ds/Route';
global.Route = Route;
// (new TemplateVisual(new Template(TestPlan), [4,25])).draw()

import Region from '/ds/Region';
global.Region = Region;

const orgOTS = Object.prototype.toString;
Object.prototype.toString = function() {
	const result = orgOTS.apply(this, arguments);
	if (result === '[object Object]' && this.constructor && this.constructor.name)
		return `[${this.constructor.name}]`;
	return result;
}