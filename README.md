# Serial Sniffer

Sniffer serial traffics between two devices.

## Cable and Connection

RX/TX lines of the serial bus are connected perspectively to the two RX pins of
different serial devices on a PC.

A sample connection and cable: 

![](doc/sample-cable.png)

## Installation

```bash
$ npm install
```

## Usage

Linux:
```bash
./bin/serisnif -l /dev/ttyUSB0 -L foo -r /dev/ttyUSB1 -R bar -b 9600 -f foo-bar.log
```

Windows:
```bash
node ./src/serisnif.js -l -L foo COM1 -r COM2 -R bar -b 9600 -f foo-bar.log
```

Options:

- `-l --left dev`: left side device
- `-L --lefttName name`: left side device name
- `-r --right dev`: right side device
- `-R --rightName name`: right side device name
- `-b --baud`: baud rate
- `-f --file filename`: save logs into a file 
- `-i --inter-frame-timeout n`: inter-fame timeout time in ms
- `-h --help`: help

## Log File Max Size

By default, the log file will automatically split once it reaached size of 10M.
The size limit can be configured by '-s N', where N is in Kilo-byte.
