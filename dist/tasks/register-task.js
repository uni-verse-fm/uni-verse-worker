"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const child_process_1 = __importDefault(require("child_process"));
const axios_1 = __importDefault(require("axios"));
class RegisterTask {
    constructor(minioAddress, minioPort) {
        this.channelName = 'uni-verse-fp-in';
        this.minioBaseUrl = `http://${minioAddress}:${minioPort}/tracks/`;
    }
    performRequest(trackUrl) {
        return (0, axios_1.default)({
            url: `${this.minioBaseUrl}${trackUrl}`,
            method: 'GET',
            responseType: 'stream',
        });
    }
    createChildProcess(trackUrl, callBack) {
        const child = child_process_1.default.exec(`olaf store ./tracks/${trackUrl}`);
        if (child != null) {
            console.log('Plugin child process logs to stdout');
            child.stdout?.pipe(process.stdout, { end: false });
            console.log('Plugin child process errors to stderr');
            child.stderr?.pipe(process.stderr, { end: false });
            console.log('resuming child process');
            process.stdin.resume();
            child.on('end', (code, signal) => {
                fs_1.default.rmSync(`./tracks/${trackUrl}`);
                process.stdout.write(`Exited with ${code} and ${signal}`);
                callBack();
            });
            child.on('error', (msg) => {
                console.error(msg);
                callBack();
            });
            child.on('exit', (code, signal) => {
                fs_1.default.rmSync(`./tracks/${trackUrl}`);
                process.stdout.write(`Exited with ${code} and ${signal}`);
                callBack();
            });
        }
        else {
            console.error('Could not create child process !');
            callBack();
        }
    }
    async perform(msg, callBack) {
        // cannot operate without a payload
        if (!msg) {
            return;
        }
        // parse payload
        const trackUrl = JSON.parse(msg.content.toString()).track_url;
        // prepare file write stream
        const writer = fs_1.default.createWriteStream(`tracks/${trackUrl}`);
        console.log(`Downloading:${this.minioBaseUrl}${trackUrl}`);
        this.performRequest(trackUrl)
            .then((response) => {
            response.data.pipe(writer);
            console.log('Spawning process');
            this.createChildProcess(trackUrl, callBack);
        })
            .catch((err) => {
            console.error(`Could not download file : ${err}`);
        });
    }
}
exports.default = RegisterTask;
