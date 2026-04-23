import { Queue } from 'bullmq'

export const generationQueue = new Queue('image-generation', {
  connection: { url: process.env.REDIS_URL },
})
