import { IFpTask } from './tasks';
import Fs from 'fs';
import Cp from 'child_process';
import axios from 'axios';
import amqp from 'amqplib';
import { AxiosResponse } from 'axios';

class SearchTask implements IFpTask {
  readonly channelName = 'uni-verse-fp-search';
  readonly matchLogRegex: RegExp =
    /\d, \d, [a-z0-9]+.(?:wav|mp3|ogg|flac|wave|m4a|aac), \d+, [A-Za-z\/]+([a-z0-9]+.(?:wav|mp3|ogg|flac|wave|m4a|aac)), [0-9]+, [\-\.0-9]+, [\-\.0-9]+, [\-\.0-9]+, [\-\.0-9]+/i;

  readonly minioBaseUrl: string;
  readonly apiBaseUrl: string;

  constructor(
    minioAddress: string,
    minioPort: string,
    apiAddresse: string,
    apiPort: string,
  ) {
    this.minioBaseUrl = `http://${minioAddress}:${minioPort}/extracts/`;
    this.apiBaseUrl = `http://${apiAddresse}:${apiPort}/fp-searches/`;
  }

  private performRequest(extractUrl: string): Promise<AxiosResponse> {
    return axios({
      url: `${this.minioBaseUrl}${extractUrl}`,
      method: 'GET',
      responseType: 'stream',
    });
  }

  private performReport(foundTrackFileName: string, searchId: string) {
    return axios({
      url: `${this.apiBaseUrl}${searchId}`,
      data: {
        foundTrackFileName,
        takenTime: 1,
      },
      method: 'PATCH',
      responseType: 'json',
    });
  }

  private parseLogsAndReport(logs: string, searchId: string) {
    console.log(`read: ${logs}`);
    if (this.matchLogRegex.test(logs)) {
      const matches = logs.match(this.matchLogRegex);
      if (matches) {
        console.log(`Found matching file: ${matches[1]}`);
        this.performReport(matches[1], searchId);
      } else {
        console.error('Could not match regex pattern with fp result.');
      }
    }
  }

  private createChildProcess(
    searchId: string,
    extractUrl: string,
    callBack: () => void,
  ) {
    const child = Cp.exec(`olaf query ./extracts/${extractUrl}`);

    if (child != null) {
      console.log('Plugin child process errors to stderr');
      child.stderr?.pipe(process.stderr, { end: false });

      console.log('resuming child process');
      process.stdin.resume();

      child.stdout?.on('data', (data: string) => {
        this.parseLogsAndReport(data, searchId);
      });

      child.on('end', (code, signal) => {
        Fs.rmSync(`./extracts/${extractUrl}`);

        process.stdout.write(`Exited with ${code} and ${signal}`);
        callBack();
      });

      child.on('error', (msg) => {
        console.error(msg);
        callBack();
      });

      child.on('exit', (code, signal) => {
        Fs.rmSync(`./extracts/${extractUrl}`);

        process.stdout.write(`Exited with ${code} and ${signal}`);
        callBack();
      });
    } else {
      console.error('Could not create child process !');
      callBack();
    }
  }

  async perform(
    msg: amqp.ConsumeMessage | null,
    callBack: () => void,
  ): Promise<void> {
    // cannot operate without a payload
    if (!msg) {
      return;
    }

    // parse payload
    const extractUrl = JSON.parse(msg.content.toString()).extract_url;
    const searchId = JSON.parse(msg.content.toString()).search_id;

    // Create folder if it doesnt exist to avoid errror
    if (!Fs.existsSync('extracts')) {
      Fs.mkdirSync('extracts');
    }

    // prepare file write stream
    const writer = Fs.createWriteStream(`extracts/${extractUrl}`);

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

export default SearchTask;
