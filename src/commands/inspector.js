import * as Cmd from '/os/core/commands';
import * as Inspector from '/os/core/ins/inspector';

const CMD_CATEGORY = 'Inspector';

Cmd.register('explain', (x) => JSON.stringify(x, null, 2), 'Explain (Pretty print an object)', ['ex'], CMD_CATEGORY);
Cmd.register('getParamStr', Inspector.getParamStr, 'Show the parameter names for a function', ['params'], CMD_CATEGORY);
Cmd.register('inspect', Inspector.inspect, 'Inspect an object or prototype', ['ins'], CMD_CATEGORY);
Cmd.register('prop_find', Inspector.findProperty, 'Find a property in a prototype chain', ['propf'], CMD_CATEGORY);