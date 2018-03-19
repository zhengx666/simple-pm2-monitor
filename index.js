let pm2 = require('pm2');
let pmx = require('pmx');


// Get the configuration from PM2
let conf = pmx.initModule();

// initialize buffer and queue_max opts
// buffer seconds can be between 1 and 5
conf.buffer_seconds = (conf.buffer_seconds > 0 && conf.buffer_seconds < 5) ? conf.buffer_seconds : 1;

// queue max can be between 10 and 100
conf.queue_max = (conf.queue_max > 10 && conf.queue_max <= 100) ? conf.queue_max : 100;

//['stop', 'exit', 'delete', 'error', 'kill', 'exception', 'restart overlimit', 'suppressed'];

// create the message queue
let messages = [];

// create the suppressed object for sending suppression messages
let suppressed = {
    isSuppressed: false,
    date: new Date().getTime()
};


// Function to process the message queue
function processQueue() {

    // If there are over conf.queue_max messages in the queue, send the suppression message if it has not been sent and delete all the messages in the queue after this amount (default: 100)
    if (messages.length > conf.queue_max) {
        if (!suppressed.isSuppressed) {
            suppressed.isSuppressed = true;
            suppressed.date = new Date().getTime();
        }
        messages.splice(conf.queue_max, messages.length);
    }

    // If the suppression message has been sent over 1 minute ago, we need to reset it back to false
    if (suppressed.isSuppressed && suppressed.date < (new Date().getTime() - 60000)) {
        suppressed.isSuppressed = false;
    }

    // Wait 10 seconds and then process the next message in the queue
    setTimeout(function () {
        processQueue();
    }, 10000);
}

// Start listening on the PM2 BUS
pm2.launchBus(function (err, bus) {

    // Listen for process logs
    if (conf.log) {
        bus.on('log:out', function (data) {
            if (data.process.name !== 'pm2-event-monitor' && data.process.name !== 'pm2-logrotate') {
               console.log("log:out");
            }
        });
    }

    // Listen for process errors
    if (conf.error) {
        bus.on('log:err', function (data) {
            if (data.process.name !== 'pm2-event-monitor' && data.process.name !== 'pm2-logrotate') {
                console.log('log:err');
            }
        });
    }

    // Listen for PM2 kill
    if (conf.kill) {
        bus.on('pm2:kill', function (data) {
            console.log('pm2:kill');
        });
    }

    // Listen for process exceptions
    if (conf.exception) {
        bus.on('process:exception', function (data) {
            if (data.process.name !== 'pm2-event-monitor' && data.process.name !== 'pm2-logrotate') {
                console.log('process:exception')
            }
        });
    }

    // Listen for PM2 events
    bus.on('process:event', function (data) {
        if (conf[data.event]) {
            console.log('process:event uninstall');
            // console.log(data);
        }
    });

    // Start the message processing
    processQueue();
});
