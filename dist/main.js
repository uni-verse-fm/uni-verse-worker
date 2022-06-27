'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib_1 = __importDefault(require("amqplib"));
const bluebird_1 = __importDefault(require("bluebird"));
const config_1 = __importDefault(require("./config"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = __importDefault(require("child_process"));
const assertQueueOptions = { durable: true };
const consumeQueueOptions = { noAck: false };
const rabbit_uri = `amqp://${config_1.default.rabbitMqUrl}:${config_1.default.rabbitMqPort}`;
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
const genRandomTime = () => Math.random() * 1000;
let available = true;
const registerFp = async (msg) => {
    const track_url = JSON.parse(msg.content.toString()).track_url;
    const writer = fs_1.default.createWriteStream(`tracks/${track_url}`);
    const remoteUrl = `http://${config_1.default.minioAddress}:${config_1.default.minioPort}/tracks/${track_url}`;
    console.log(`Downloading:${remoteUrl}`);
    const response = await (0, axios_1.default)({
        url: remoteUrl,
        method: 'GET',
        responseType: 'stream', // important
    }).catch(err => {
        console.error(`Could not download file : ${err}`);
    });
    if (response) {
        response.data.pipe(writer);
        console.log("Spawning process");
        const child = child_process_1.default.exec(`olaf store ./tracks/${track_url}`);
        if (child != null) {
            console.log("Plugin child process logs to stdout");
            child.stdout?.pipe(process.stdout, { end: false });
            console.log("Plugin child process errors to stderr");
            child.stderr?.pipe(process.stderr, { end: false });
            console.log("resuming child process");
            process.stdin.resume();
            child.stdin?.on('end', (code, signal) => {
                fs_1.default.rmSync(`./tracks/${track_url}`);
                process.stdout.write(`Exited with ${code} and ${signal}`);
                available = true;
            });
            child.on('error', msg => {
                console.error(msg);
            });
            child.on('exit', (code, signal) => {
                fs_1.default.rmSync(`./tracks/${track_url}`);
                process.stdout.write(`Exited with ${code} and ${signal}`);
            });
        }
    }
};
const assertAndConsumeQueue = async (channel) => {
    const ackMsg = (msg) => bluebird_1.default.resolve(msg)
        .tap(msg => registerFp(msg))
        .then((msg) => channel.ack(msg));
    while (true) {
        available = false;
        console.log("Waiting for a file");
        channel.assertQueue(config_1.default.workQueue, assertQueueOptions)
            .then(() => channel.prefetch(1))
            .then(() => channel.consume(config_1.default.workQueue, ackMsg, consumeQueueOptions));
        while (!available) {
            await sleep(1000);
        }
    }
};
const listenToQueue = () => amqplib_1.default.connect(rabbit_uri)
    .then(connection => connection.createChannel())
    .then(channel => assertAndConsumeQueue(channel))
    .catch(err => {
    console.error("Could not connect to message broker service");
    console.error(err);
});
listenToQueue();
