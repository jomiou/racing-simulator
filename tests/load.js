// Loads the browser scripts (track data + simulation) into Node for testing.
const fs = require('fs');
const path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
globalThis.SPA_DATA = new Function(src('spa-data.js') + ';return SPA_DATA;')();
module.exports = new Function('module', src('sim.js') + ';return SIM;')({});
