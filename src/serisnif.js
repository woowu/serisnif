#!/usr/bin/node --harmony
'use strict';

const fs = require('fs');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const { SerialPort } = require('serialport');
const dump = require('buffer-hexdump');
const moment = require('moment');
const { MESSAGE } = require('triple-beam');
const jsonStringify = require('safe-stable-stringify');
const logform = require('logform');
const winston = require('winston');

const DEFAULT_LOG_FILE_MAX_SIZE = 10 * 1024;

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
    .option('file', {
        alias: 'f',
        describe: 'save to file',
        type: 'string',
    })
    .option('max-size', {
        alias: 's',
        describe: 'maxsize of each saved log file (in KB)',
        nargs: 1,
        type: 'number',
        default: DEFAULT_LOG_FILE_MAX_SIZE,
    })
    .option('left-name', {
        alias: 'L',
        describe: 'left device name',
        type: 'string',
        default: 'left',
    })
    .option('right-name', {
        alias: 'R',
        describe: 'right device name',
        type: 'string',
        default: 'right',
    })
    .argv;

const logFormat = logform.format((info, opts) => {
    /*
     * @param {Object} info
     * @param {string} info.level
     * @param {Date} info.timestamp
     * @param {string} info.name
     * @param {Buffer} info.data
     * @param {number} info.offset
     */

    var m = moment(info.timestamp).format('YYYY-MM-DDTHH:mm:ss.SSS')
        + ' ' + info.name + ' len ' + info.data.length
        + ' from ' + info.offset + ' to ' + (info.offset + info.data.length - 1);
    if (opts.multiLines)
        m += '\n' + dump(info.data);
    else
        m += ': ' + info.data.toString('hex');

    info[MESSAGE] = m;
    return info;
});

const logger = winston.createLogger({
    level: 'debug',
    transports: [
        new winston.transports.Console({
            format: logFormat({ multiLines: true }),
        }),
    ],
});
if (argv.file)
    logger.add(new winston.transports.File({
        filename: argv.file,
        format: logFormat({ multiLines: false }),
        maxsize: argv.maxSize * 1024,
    }));

class SerialListener extends EventEmitter {
    constructor(device, baud, interframeTimeout, name) {
        super();

        this.serial = new SerialPort({
            path: device,
            baudRate: baud,
            autoOpen: false,
        });
        this._name = device + (name ? ' (' + name + ')' : '');
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

/*---*/

const left = argv.left
    ? new SerialListener(argv.left, argv.baud, argv.interFrameTimeout, argv.leftName) : null;
const right = argv.right
    ? new SerialListener(argv.right, argv.baud, argv.interFrameTimeout, argv.rightName) : null;

[left, right].forEach(dev => {
    if (! dev) return;
    dev.on('data', ({ time, offset, data }) => {
        logger.log({
            level: 'info',
            timestamp: new Date(),
            name: dev.name(),
            data: data,
            offset: offset,
            message: '',
        });
    });
});
