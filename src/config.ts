export default {
  rabbitMqUrl: process.env.RMQ_URL || 'localhost',
  rabbitMqPort: process.env.RMQ_PORT || '5672',
  rabbitUser: process.env.RABBIT_USER || 'guest',
  rabbitPassword: process.env.RABBIT_PASSWORD || 'guest',
  workQueue: process.env.IN_QUEUE_NAME || 'uni-verse-fp-in',
  minioAddress: process.env.MINIO_ENDPOINT || 'localhost',
  minioPort: process.env.MINIO_PORT || '9000',
  task: process.env.TASK || 'register',
  apiHost: process.env.INTERNAL_API_HOST || 'dev',
  apiPort: process.env.INTERNAL_API_PORT || '3000',
};
