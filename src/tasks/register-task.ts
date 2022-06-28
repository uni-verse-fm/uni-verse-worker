import { IFpTask } from './tasks';
import Fs from 'fs';
import Cp from 'child_process';
import axios from 'axios';
import amqp from 'amqplib';
import { AxiosResponse } from 'axios';

class RegisterTask implements IFpTask {
  readonly channelName = 'uni-verse-fp-in';
  readonly minioBaseUrl: string;

  constructor(minioAddress: string, minioPort: string) {
    this.minioBaseUrl = `http://${minioAddress}:${minioPort}/tracks/`;
  }

  private performRequest(trackUrl: string): Promise<AxiosResponse> {
    return axios({
      url: `${this.minioBaseUrl}${trackUrl}`,
      method: 'GET',
      responseType: 'stream',
    });
  }

  private createChildProcess(trackUrl: string, callBack: () => void) {
    const child = Cp.exec(`olaf store ./tracks/${trackUrl}`);

    if (child != null) {
      console.log('Plugin child process logs to stdout');
      child.stdout?.pipe(process.stdout, { end: false });

      console.log('Plugin child process errors to stderr');
      child.stderr?.pipe(process.stderr, { end: false });

      console.log('resuming child process');
      process.stdin.resume();

      child.on('end', (code, signal) => {
        Fs.rmSync(`./tracks/${trackUrl}`);

        process.stdout.write(`Exited with ${code} and ${signal}`);
        callBack();
      });

      child.on('error', (msg) => {
        console.error(msg);
        callBack();
      });

      child.on('exit', (code, signal) => {
        Fs.rmSync(`./tracks/${trackUrl}`);
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
    const trackUrl = JSON.parse(msg.content.toString()).track_url;

    // prepare file write stream
    const writer = Fs.createWriteStream(`tracks/${trackUrl}`);

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

export default RegisterTask;
