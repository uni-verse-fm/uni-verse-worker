"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const child_process_1 = __importDefault(require("child_process"));
const axios_1 = __importDefault(require("axios"));
class SearchTask {
    constructor(minioAddress, minioPort, apiAddresse, apiPort) {
        this.channelName = 'uni-verse-fp-search';
        this.matchLogRegex = /\d, \d, [a-z0-9]+.(?:wav|mp3|ogg|flac|wave), \d+, [A-Za-z\/]+([a-z0-9]+.(?:wav|mp3|ogg|flac|wave)), [0-9]+, [\-\.0-9]+, [\-\.0-9]+, [\-\.0-9]+, [\-\.0-9]+/i;
        this.minioBaseUrl = `http://${minioAddress}:${minioPort}/extracts/`;
        this.apiBaseUrl = `http://${apiAddresse}:${apiPort}/fp-searches/`;
    }
    performRequest(extractUrl) {
        return (0, axios_1.default)({
            url: `${this.minioBaseUrl}${extractUrl}`,
            method: 'GET',
            responseType: 'stream',
        });
    }
    performReport(foundTrackFileName, searchId) {
        return (0, axios_1.default)({
            url: `${this.apiBaseUrl}${searchId}`,
            data: {
                foundTrackFileName,
                takenTime: 1,
            },
            method: 'PATCH',
            responseType: 'json',
        });
    }
    parseLogsAndReport(logs, searchId) {
        console.log(`read: ${logs}`);
        if (this.matchLogRegex.test(logs)) {
            const matches = logs.match(this.matchLogRegex);
            if (matches) {
                console.log(`Found matching file: ${matches[1]}`);
                this.performReport(matches[1], searchId);
            }
            else {
                console.error('Could not match regex pattern with fp result.');
            }
        }
    }
    createChildProcess(searchId, extractUrl, callBack) {
        const child = child_process_1.default.exec(`olaf query ./extracts/${extractUrl}`);
        if (child != null) {
            console.log('Plugin child process errors to stderr');
            child.stderr?.pipe(process.stderr, { end: false });
            console.log('resuming child process');
            process.stdin.resume();
            child.stdout?.on('data', (data) => {
                this.parseLogsAndReport(data, searchId);
            });
            child.on('end', (code, signal) => {
                fs_1.default.rmSync(`./extracts/${extractUrl}`);
                process.stdout.write(`Exited with ${code} and ${signal}`);
                callBack();
            });
            child.on('error', (msg) => {
                console.error(msg);
                callBack();
            });
            child.on('exit', (code, signal) => {
                fs_1.default.rmSync(`./extracts/${extractUrl}`);
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
        const extractUrl = JSON.parse(msg.content.toString()).extract_url;
        const searchId = JSON.parse(msg.content.toString()).search_id;
        // prepare file write stream
        const writer = fs_1.default.createWriteStream(`extracts/${extractUrl}`);
        console.log(`Downloading:${this.minioBaseUrl}${extractUrl}`);
        this.performRequest(extractUrl)
            .then((response) => {
            response.data.pipe(writer);
            console.log('Spawning process');
            this.createChildProcess(searchId, extractUrl, callBack);
        })
            .catch((err) => {
            console.error(`Could not download file : ${err}`);
        });
    }
}
exports.default = SearchTask;
