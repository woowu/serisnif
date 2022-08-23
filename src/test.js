#!/usr/bin/node --harmony
'use strict';

/**
 * Send traffics to two serial ports at the same time, used as a test tool for
 * the serisnif.
 */

const { SerialPort } = require('serialport');
const dump = require('buffer-hexdump');
const crypto = require('node:crypto');

const argv = require('yargs/yargs')(process.argv.slice(2))
    .version('1.0.0')
    .alias('version', 'v')
    .help()
    .alias('help', 'h')
    .option('left', {
        alias: 'l',
        describe: 'left device',
        type: 'string',
    })
    .option('right', {
        alias: 'r',
        describe: 'right device',
        type: 'string',
    })
    .option('inter-frame-timeout', {
        alias: 'i',
        describe: 'inter-frame-timeout',
        type: 'numeric',
        default: 200,
    })
    .option('baud', {
        alias: 'b',
        describe: 'baud rate',
        type: 'numeric',
        default: 115200,
    })
    .argv;

function Sio(dev, baud) {
    this._dev = dev;
    this._baud = baud;

    this._serial = new SerialPort({
        path: this._dev,
        baudRate: this._baud,
        autoOpen: false,
    });
}

Object.defineProperty(Sio.prototype, 'dev', {
  enumerable: true,
  get: function () { return (this._dev); }
});

Sio.prototype.open = function() {
    return new Promise(resolve => {
        this._serial.open(err => {
            if (err) throw new Error(err);
            resolve();
        });
    });
};

Sio.prototype.write = function(data) {
    return new Promise(resolve => {
        this._serial.write(data, err => {
            if (err) throw new Error(err);
            resolve();
        });
    });
};

const delay = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/*---*/

const left = argv.left
    ? new Sio(argv.left, argv.baud) : null;
const right = argv.right
    ? new Sio(argv.right, argv.baud) : null;

(async ()=> {
    if (left) await left.open();
    if (right) await right.open();

    while (true) {
        for (const s of [left, right]) {
            const data = crypto.randomBytes(crypto.randomInt(8, 64));
            console.log('write ' + s.dev + ' len ' + data.length);
            console.log(dump(data));
            await s.write(data);
            await delay(50 + crypto.randomInt(0, 1000));
        };
    }
})();
