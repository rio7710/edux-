import { Queue } from 'bullmq';
import { logger } from './logger.js';

// Define queue name
export const RENDER_QUEUE_NAME = 'renderPdfQueue';

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
};

// Lazy-initialized queue (created on first use)
let _renderQueue: Queue | null = null;
let _redisAvailable: boolean | null = null;

/**
 * Get the render queue instance.
 * Returns null if Redis is not available.
 */
export function getRenderQueue(): Queue | null {
  if (_redisAvailable === false) return null;

  if (!_renderQueue) {
    try {
      _renderQueue = new Queue(RENDER_QUEUE_NAME, {
        connection,
      });

      // Listen for error to mark Redis as unavailable
      _renderQueue.on('error', (err) => {
        logger.warn('queue.error', {
          queue: RENDER_QUEUE_NAME,
          message: err.message,
        });
        _redisAvailable = false;
      });

      _redisAvailable = true;
      logger.info('queue.initialized', { queue: RENDER_QUEUE_NAME });
    } catch {
      logger.warn('queue.init_failed', {
        queue: RENDER_QUEUE_NAME,
        reason: 'redis-not-available',
      });
      _redisAvailable = false;
      return null;
    }
  }

  return _renderQueue;
}

/**
 * Check if Redis/BullMQ is available.
 */
export function isQueueAvailable(): boolean {
  return _redisAvailable === true && _renderQueue !== null;
}

// For backward compatibility - lazy getter
export const renderQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    const queue = getRenderQueue();
    if (!queue) {
      if (prop === 'add') {
        return () => {
          throw new Error('Redis is not available. PDF rendering is disabled. Start Redis to enable this feature.');
        };
      }
      return undefined;
    }
    return (queue as unknown as Record<string | symbol, unknown>)[prop];
  },
});
