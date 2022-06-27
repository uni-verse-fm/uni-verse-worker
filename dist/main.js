'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("./config"));
const listener_1 = __importDefault(require("./listener"));
const tasks_1 = require("./tasks/tasks");
const process_1 = require("process");
const register_task_1 = __importDefault(require("./tasks/register-task"));
const rabbit_uri = `amqp://${config_1.default.rabbitMqUrl}:${config_1.default.rabbitMqPort}`;
let task;
switch (config_1.default.task) {
    case tasks_1.TaskType.REGISTER:
        task = new register_task_1.default(config_1.default.minioAddress, config_1.default.minioPort);
        break;
    case tasks_1.TaskType.SEARCH:
        task = new register_task_1.default(config_1.default.minioAddress, config_1.default.minioPort);
        break;
    default:
        console.error(`Aborting due to unknown task type. Valid ones are: ${Object.entries(tasks_1.TaskType).map((s) => `${s.toString()}, `)}`);
        (0, process_1.exit)(1);
}
const listener = new listener_1.default(rabbit_uri, task);
listener.listen();
