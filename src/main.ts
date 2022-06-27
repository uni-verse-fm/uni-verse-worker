'use strict'

import amqp from 'amqplib'
import bb from 'bluebird'
import config from './config'
import axios from 'axios'
import Fs from 'fs'
import Cp from 'child_process'
import { sign } from 'crypto'

const assertQueueOptions = { durable: true }
const consumeQueueOptions = { noAck: false }

const rabbit_uri = `amqp://${config.rabbitMqUrl}:${config.rabbitMqPort}`

const sleep = (delay: number | undefined) => new Promise((resolve) => setTimeout(resolve, delay))

const genRandomTime = () => Math.random() * 1000

let available = true;

const registerFp = async (msg: { content: { toString: () => string } }) => {
    const track_url = JSON.parse(msg.content.toString()).track_url
    const writer = Fs.createWriteStream(`tracks/${track_url}`)

    const remoteUrl = `http://${config.minioAddress}:${config.minioPort}/tracks/${track_url}`;

    console.log(`Downloading:${remoteUrl}`)

    const response = await axios({
        url: remoteUrl, //your url
        method: 'GET',
        responseType: 'stream', // important
    }).catch(err => {
        console.error(`Could not download file : ${err}`)
    })

    if (response) {
        response.data.pipe(writer)

        console.log("Spawning process")

        const child = Cp.exec(`olaf store ./tracks/${track_url}`)

        if (child != null) {
            console.log("Plugin child process logs to stdout")
            child.stdout?.pipe(process.stdout, { end: false });

            console.log("Plugin child process errors to stderr")
            child.stderr?.pipe(process.stderr, { end: false });

            console.log("resuming child process")
            process.stdin.resume();

            child.stdin?.on('end', (code, signal) => {
                Fs.rmSync(`./tracks/${track_url}`)

                process.stdout.write(`Exited with ${code} and ${signal}`);
                available = true
            });

            child.on('error', msg => {
                console.error(msg);
            })

            child.on('exit', (code, signal) => {
                Fs.rmSync(`./tracks/${track_url}`)
                process.stdout.write(`Exited with ${code} and ${signal}`);
            });
        }
    }
}



const assertAndConsumeQueue = async (channel: amqp.Channel) => {

    const ackMsg = (msg: any) => bb.resolve(msg)
        .tap(msg => registerFp(msg))
        .then((msg) => channel.ack(msg))

    while (true) {
        available = false;
        console.log("Waiting for a file")
        channel.assertQueue(config.workQueue, assertQueueOptions)
            .then(() => channel.prefetch(1))
            .then(() => channel.consume(config.workQueue, ackMsg, consumeQueueOptions))

        while (!available) {
            await sleep(1000)
        }
    }

}


const listenToQueue = () => amqp.connect(rabbit_uri)
    .then(connection => connection.createChannel())
    .then(channel => assertAndConsumeQueue(channel))
    .catch(err => {
        console.error("Could not connect to message broker service")
        console.error(err)
    })


listenToQueue();
