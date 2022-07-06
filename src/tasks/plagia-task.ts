import { IFpTask } from './tasks';
import Fs from 'fs';
import Cp from 'child_process';
import axios from 'axios';
import amqp from 'amqplib';
import { AxiosResponse } from 'axios';

class PlagiaTask implements IFpTask {
  readonly channelName = 'uni-verse-plagia-in';
  readonly matchLogRegex: RegExp =
    /\d, \d, [a-z0-9]+.(?:wav|mp3|ogg|flac|wave|m4a|aac), \d+, [A-Za-z\/]+([a-z0-9]+.(?:wav|mp3|ogg|flac|wave|m4a|aac)), [0-9]+, [\-\.0-9]+, [\-\.0-9]+, [\-\.0-9]+, [\-\.0-9]+/i;

  readonly minioBaseUrl: string;
  readonly apiBaseUrl: string;
  readonly apiKey: string;

  constructor(
    minioAddress: string,
    minioPort: string,
    apiAddresse: string,
    apiPort: string,
    apiKey: string,
  ) {
    this.minioBaseUrl = `http://${minioAddress}:${minioPort}/tracks/`;
    this.apiBaseUrl = `http://${apiAddresse}:${apiPort}/tracks/plagia/`;
    this.apiKey = apiKey;
  }

  private performRequest(extractUrl: string): Promise<AxiosResponse> {
    return axios({
      url: `${this.minioBaseUrl}${extractUrl}`,
      method: 'GET',
      responseType: 'stream',
    });
  }

  private performReport(foundTrackFileName: string, trackId: string) {
    return axios({
      url: `${this.apiBaseUrl}${trackId}`,
      method: 'PATCH',
      headers: {
        Authorization: this.apiKey,
      },
    });
  }

  private parseLogsAndReport(logs: string, trackId: string) {
    console.log(`read: ${logs}`);
    if (this.matchLogRegex.test(logs)) {
      const matches = logs.match(this.matchLogRegex);
      if (matches) {
        console.log(`Found matching file: ${matches[1]}`);
        this.performReport(matches[1], trackId)
          .then((res) => {
            console.log(res.data);
          })
          .catch((err) => {
            console.error(err);
          });
      } else {
        console.error('Could not match regex pattern with fp result.');
      }
    }
  }

  private createChildProcess(
    trackId: string,
    extractUrl: string,
    callBack: () => void,
  ) {
    const child = Cp.exec(`olaf query ./tracks/${extractUrl}`);

    if (child != null) {
      console.log('Plugin child process errors to stderr');
      child.stderr?.pipe(process.stderr, { end: false });

      console.log('resuming child process');
      process.stdin.resume();

      child.stdout?.on('data', (data: string) => {
        this.parseLogsAndReport(data, trackId);
      });

      child.on('end', (code, signal) => {
        Fs.rmSync(`./tracks/${extractUrl}`);

        process.stdout.write(`Exited with ${code} and ${signal}`);
        callBack();
      });

      child.on('error', (msg) => {
        console.error(msg);
        callBack();
      });

      child.on('exit', (code, signal) => {
        Fs.rmSync(`./tracks/${extractUrl}`);

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
    const extractUrl = JSON.parse(msg.content.toString()).track_url;
    const trackId = JSON.parse(msg.content.toString()).id;

    // Create folder if it doesnt exist to avoid errror
    if (!Fs.existsSync('tracks')) {
      Fs.mkdirSync('tracks');
    }

    // prepare file write stream
    const writer = Fs.createWriteStream(`tracks/${extractUrl}`);

    console.log(`Downloading:${this.minioBaseUrl}${extractUrl}`);

    this.performRequest(extractUrl)
      .then((response) => {
        response.data.pipe(writer);

        console.log('Spawning process');
        this.createChildProcess(trackId, extractUrl, callBack);
      })
      .catch((err) => {
        console.error(`Could not download file : ${err}`);
      });
  }
}

export default PlagiaTask;
