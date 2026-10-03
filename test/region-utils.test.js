const test = require('node:test');
const assert = require('node:assert/strict');
const region = require('../src/content/region-utils.js');

test('reverse drag is normalized and clipped to the viewport', () => {
  assert.deepEqual(region.selectionRect({ x: 900, y: 700 }, { x: -20, y: 30 }, { width: 800, height: 600 }),
    { left: 0, top: 30, width: 800, height: 570 });
});
test('empty or tiny drags cannot be exported', () => {
  assert.equal(region.selectionRect({ x: 20, y: 20 }, { x: 21, y: 100 }, { width: 800, height: 600 }), null);
});
test('crop maps CSS coordinates to screenshot pixels with independent scales', () => {
  assert.deepEqual(region.cropRect({ left: 10.25, top: 20, width: 100.5, height: 50 },
    { width: 800, height: 600 }, { width: 1600, height: 900 }),
    { left: 20, top: 30, width: 202, height: 75 });
});
test('crop never extends beyond screenshot bounds', () => {
  assert.deepEqual(region.cropRect({ left: 790, top: 590, width: 40, height: 40 },
    { width: 800, height: 600 }, { width: 1600, height: 1200 }),
    { left: 1580, top: 1180, width: 20, height: 20 });
});
