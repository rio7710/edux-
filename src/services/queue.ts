import { Queue } from 'bullmq';
// import { prisma } from './prisma.js'; // Not needed in queue.ts
// import puppeteer from 'puppeteer'; // Not needed in queue.ts

// Define queue name
export const RENDER_QUEUE_NAME = 'renderPdfQueue';

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD, // Optional
};

// Create a new queue
export const renderQueue = new Queue(RENDER_QUEUE_NAME, { connection });

// Removed worker-related commented code as worker is now in src/workers/pdfWorker.ts

console.log(`BullMQ Queue '${RENDER_QUEUE_NAME}' initialized.`);