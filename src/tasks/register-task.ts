import { IFpTask } from './tasks';
import Fs from 'fs';
import Cp from 'child_process';
import axios from 'axios';
import amqp from 'amqplib';
import { AxiosResponse } from 'axios';
import { exit } from 'process';

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

  private createChildProcess(trackUrl: string) {
    const child = Cp.exec(`olaf store ./tracks/${trackUrl}`);

    if (child != null) {
      console.log('Plugin child process logs to stdout');
      child.stdout?.pipe(process.stdout, { end: false });

      console.log('Plugin child process errors to stderr');
      child.stderr?.pipe(process.stderr, { end: false });

      console.log('resuming child process');
      process.stdin.resume();

      child.stdin?.on('end', (code, signal) => {
        Fs.rmSync(`./tracks/${trackUrl}`);

        process.stdout.write(`Exited with ${code} and ${signal}`);
      });

      child.on('error', (msg) => {
        console.error(msg);
      });

      child.on('exit', (code, signal) => {
        Fs.rmSync(`./tracks/${trackUrl}`);
        process.stdout.write(`Exited with ${code} and ${signal}`);
      });
    } else {
      console.error('Could not create child process !');
      exit(1);
    }
  }

  async perform(msg: amqp.ConsumeMessage | null): Promise<void> {
    // cannot operate without a payload
    if (!msg) {
      return;
    }

    // parse payload
    const trackUrl = JSON.parse(msg.content.toString()).trackUrl;

    // prepare file write stream
    const writer = Fs.createWriteStream(`tracks/${trackUrl}`);

    console.log(`Downloading:${this.minioBaseUrl}${trackUrl}`);

    this.performRequest(trackUrl)
      .then((response) => {
        response.data.pipe(writer);

        console.log('Spawning process');
        this.createChildProcess(trackUrl);
      })
      .catch((err) => {
        console.error(`Could not download file : ${err}`);
      });
  }
}

export default RegisterTask;
