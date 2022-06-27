import amqp from 'amqplib';

export interface IFpTask {
  perform: (msg: amqp.ConsumeMessage | null) => void;
  channelName: string;
}

export enum TaskType {
  REGISTER = 'register',
  SEARCH = 'search',
}
