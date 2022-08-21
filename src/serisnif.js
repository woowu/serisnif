#!/usr/bin/node --harmony
'use strict';

const fs = require('fs');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const { SerialPort } = require('serialport');
const dump = require('buffer-hexdump');
const moment = require('moment');

class SerialListener extends EventEmitter {
    constructor(device, baud, interframeTimeout, name) {
        super();

        this.serial = new SerialPort({
            path: device,
            baudRate: baud,
            autoOpen: false,
        });
        this._name = device + (name ? ' ' + name : '');
        this.timer = null;
        this._chunk = null;
        this._offset = 0;

        this.serial.open(err => {
            if (err) {
                console.error(`Error opening ${device}:`, err.message);
                process.exit();
            }
        });
        this.serial.on('data', data => {
            clearTimeout(this.timer);
            if (! this._chunk)
                this._chunk = {
                    time: new Date(),
                    offset: this._offset,
                    data,
                }
            else
                this._chunk.data = Buffer.concat([this._chunk.data, data]);

            this.timer = setTimeout(() => {
                this._offset = this._chunk.offset + this._chunk.data.length;
                this.emit('data', this._chunk);
                this._chunk = null;
            }, interframeTimeout);
        });
    }

    name() {
        return this._name;
    }
}

const makeLogger = file => {
    const logStream = fs.createWriteStream(file);
    const queue = [];
    var buffWaiting = false;

    const write = () => {
        while (queue.length) {
            const line = queue.shift();
            if (! logStream.write(line)) {
                logStream.once('drain', write);
                buffWaiting = true;
                break;
            }
            buffWaiting = false;
        }
    };

    logStream.on('error', err => {
        console.error(err.message);
        process.exit(1);
    });

    return line => {
        queue.push(line);
        if (queue.length > 1 || buffWaiting) return;
        process.nextTick(write);
    };
};

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
        default: 200,
    })
    .option('baud', {
        alias: 'b',
        describe: 'baud rate',
        type: 'numeric',
        default: 115200,
    })
    .option('log', {
        alias: 'f',
        describe: 'log file',
        type: 'string',
    })
    .option('left-name', {
        alias: 'L',
        describe: 'left device name',
        type: 'string',
        default: 'left',
    })
    .option('right-name', {
        alias: 'L',
        describe: 'right device name',
        type: 'string',
        default: 'right',
    })
    .argv;

const left = argv.left
    ? new SerialListener(argv.left, argv.baud, argv.interFrameTimeout, argv.leftName) : null;
const right = argv.right
    ? new SerialListener(argv.right, argv.baud, argv.interFrameTimeout, argv.rightName) : null;
const log = argv.log
    ? makeLogger(argv.log) : null;

[left, right].forEach(dev => {
    if (! dev) return;
    dev.on('data', ({ time, offset, data }) => {
        const timestamp = moment(time).format('YYYY-MM-DDTHH:mm:ss.SSS');
        console.log(timestamp + ' ' + dev.name()
            + ' len ' + data.length
            + ' from ' + offset + ' to ' + (offset + data.length - 1));
        console.log(dump(data));
        var logLine = timestamp;
        logLine += ' ' + dev.name();
        logLine += ' ' + data.toString('hex') + '\n'; 
        if (log) log(logLine);
    });
});
