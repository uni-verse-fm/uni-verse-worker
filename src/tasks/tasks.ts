import amqp from 'amqplib';

export interface IFpTask {
  perform: (msg: amqp.ConsumeMessage | null, callback: () => void) => void;
  channelName: string;
}

export enum TaskType {
  REGISTER = 'register',
  SEARCH = 'search',
  PLAGIAT = 'plagiat'
}
