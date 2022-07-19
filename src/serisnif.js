#!/usr/bin/node --harmony
'use strict';

const util = require('util');
const EventEmitter = require('events').EventEmitter;
const { SerialPort } = require('serialport');
const dump = require('buffer-hexdump');

class SerialListener extends EventEmitter {
    constructor(device, baud, interframeTimeout) {
        super();

        this.serial = new SerialPort({
            path: device,
            baudRate: baud,
            autoOpen: false,
        });
        this._name = device;
        this.timer = null;
        this.buf = null;

        this.serial.open(err => {
            if (err) {
                console.error(`Error opening ${device}:`, err.message);
                process.exit();
            }
        });
        this.serial.on('data', data => {
            clearTimeout(this.timer);
            if (! this.buf)
                this.buf = data;
            else
                this.buf = Buffer.concat([this.buf, data]);
            this.timer = setTimeout(() => {
                this.emit('data', this.buf);
                this.buf = null;
            }, interframeTimeout);
        });
    }

    name() {
        return this._name;
    }
}

const argv = require('yargs/yargs')(process.argv.slice(2))
    .version('0.0.1')
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
        default: 50,
    })
    .option('baud', {
        alias: 'b',
        describe: 'baud rate',
        type: 'numeric',
        default: 115200,
    })
    .argv;


var left;
var right;
left = argv.left ? new SerialListener(argv.left, argv.baud, argv.interFrameTimeout) : null;
right = argv.right ? new SerialListener(argv.right, argv.baud, argv.interFrameTimeout) : null;

[left, right].forEach(dev => {
    if (! dev) return;
    dev.on('data', data => {
        console.log(dev.name());
        console.log(dump(data));
    });
});
