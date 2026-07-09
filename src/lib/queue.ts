import { Queue } from 'bullmq'

let queue: Queue | null = null

function getQueue() {
  queue ??= new Queue('image-generation', {
    connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  })
  return queue
}

export const generationQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue().add(...args),
  get client() {
    return getQueue().client
  },
}
