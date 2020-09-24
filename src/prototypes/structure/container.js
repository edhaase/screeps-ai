/** ext/structure.container.js */
'use strict';

/* global DEFINE_CACHED_GETTER, CREEP_UPGRADE_RANGE*/

DEFINE_CACHED_GETTER(StructureContainer.prototype, 'isControllerContainer', c => !!(c.room.controller && c.room.controller.container && c.room.controller.container.id === c.id));