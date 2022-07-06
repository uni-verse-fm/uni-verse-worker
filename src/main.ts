'use strict';

import config from './config';
import Listener from './listener';
import { IFpTask, TaskType } from './tasks/tasks';
import { exit } from 'process';
import RegisterTask from './tasks/register-task';
import SearchTask from './tasks/search-task';
import PlagiaTask from './tasks/plagia-task';

const rabbit_uri = `amqp://${config.rabbitUser}:${config.rabbitPassword}@${config.rabbitMqUrl}:${config.rabbitMqPort}`;
console.log(`Connecting to ${rabbit_uri}`);

let task: IFpTask;

switch (config.task) {
  case TaskType.REGISTER:
    task = new RegisterTask(config.minioAddress, config.minioPort);
    break;
  case TaskType.SEARCH:
    task = new SearchTask(
      config.minioAddress,
      config.minioPort,
      config.apiHost,
      config.apiPort,
    );
    break;
  case TaskType.PLAGIAT:
    task = new PlagiaTask(
      config.minioAddress,
      config.minioPort,
      config.apiHost,
      config.apiPort,
      config.apiKey,
    );
    break;
  default:
    console.error(
      `Aborting due to unknown task type. Valid ones are: ${Object.entries(
        TaskType,
      ).map((s) => `${s.toString()}, `)}`,
    );
    exit(1);
}

const listener = new Listener(rabbit_uri, task);

listener.listen();
