import amqp from 'amqplib';
import { IFpTask } from './tasks/tasks';
import bb from 'bluebird';

const assertQueueOptions = { durable: true };
const consumeQueueOptions = { noAck: false };

class Listener {
  uri: string;
  task: IFpTask;

  available = true;

  constructor(uri: string, task: IFpTask) {
    this.uri = uri;
    this.task = task;
  }

  private sleep(delay: number | undefined): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async assertAndConsume(channel: amqp.Channel): Promise<void> {
    const ackMsg = (msg: amqp.ConsumeMessage | null) =>
      bb
        .resolve(msg)
        .tap((msg) => this.task.perform(msg, () => (this.available = true)))
        .then((msg) => msg && channel.ack(msg));

    while (true) {
      this.available = false;
      console.log('Waiting for a file');
      channel
        .assertQueue(this.task.channelName, assertQueueOptions)
        .then(() => channel.prefetch(1))
        .then(() =>
          channel.consume(this.task.channelName, ackMsg, consumeQueueOptions),
        );

      while (!this.available) {
        await this.sleep(1000);
      }
    }
  }

  listen(): void {
    amqp
      .connect(this.uri)
      .then((connection) => connection.createChannel())
      .then((channel) => this.assertAndConsume(channel))
      .catch((err) => {
        console.error('Could not connect to message broker service');
        console.error(err);
      });
  }
}

export default Listener;
