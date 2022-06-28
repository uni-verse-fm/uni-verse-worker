"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib_1 = __importDefault(require("amqplib"));
const bluebird_1 = __importDefault(require("bluebird"));
const assertQueueOptions = { durable: true };
const consumeQueueOptions = { noAck: false };
class Listener {
    constructor(uri, task) {
        this.available = true;
        this.uri = uri;
        this.task = task;
    }
    sleep(delay) {
        return new Promise((resolve) => setTimeout(resolve, delay));
    }
    async assertAndConsume(channel) {
        const ackMsg = (msg) => bluebird_1.default
            .resolve(msg)
            .tap((msg) => this.task.perform(msg, () => (this.available = true)))
            .then((msg) => msg && channel.ack(msg));
        while (true) {
            this.available = false;
            console.log('Waiting for a file');
            channel
                .assertQueue(this.task.channelName, assertQueueOptions)
                .then(() => channel.prefetch(1))
                .then(() => channel.consume(this.task.channelName, ackMsg, consumeQueueOptions));
            while (!this.available) {
                await this.sleep(1000);
            }
        }
    }
    listen() {
        amqplib_1.default
            .connect(this.uri)
            .then((connection) => connection.createChannel())
            .then((channel) => this.assertAndConsume(channel))
            .catch((err) => {
            console.error('Could not connect to message broker service');
            console.error(err);
        });
    }
}
exports.default = Listener;
