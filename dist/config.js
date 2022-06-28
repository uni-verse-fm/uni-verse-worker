"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    rabbitMqUrl: process.env.RMQ_URL || 'localhost',
    rabbitMqPort: process.env.RMQ_PORT || '5672',
    workQueue: process.env.IN_QUEUE_NAME || 'uni-verse-fp-in',
    minioAddress: process.env.MINIO_ENDPOINT || 'localhost',
    minioPort: process.env.MINIO_PORT || '9000',
    task: process.env.TASK || 'register',
    apiHost: process.env.INTERNAL_API_HOST || 'dev',
    apiPort: process.env.INTERNAL_API_PORT || '3000',
};
