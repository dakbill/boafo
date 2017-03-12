'use strict'
var test = require('tap').test;

function setup () {
    cleanup();
}

function cleanup () {

}

test('setup', function (t) {
    setup();
    t.end();
})

test('name-of-group-of-tests', function (t) {
    t.is('1', '1', 'description of what this is testing');
    t.done();
})

test('cleanup', function (t) {
    cleanup();
    t.end();
})