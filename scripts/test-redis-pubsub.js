#!/usr/bin/env node

const Redis = require('ioredis');
const { performance } = require('perf_hooks');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const TEST_CHANNEL = 'pubsub-speed-test';
const MESSAGE_COUNT = parseInt(process.argv[2]) || 50;
const PUBLISH_INTERVAL = parseInt(process.argv[3]) || 100; // ms between messages

console.log(`🚀 Redis Pub/Sub Speed Test`);
console.log(`📍 Redis: ${REDIS_HOST}:${REDIS_PORT}`);
console.log(`📢 Channel: ${TEST_CHANNEL}`);
console.log(`📊 Messages: ${MESSAGE_COUNT}`);
console.log(`⏱️  Interval: ${PUBLISH_INTERVAL}ms`);
console.log(`════════════════════════════════════════`);
console.log(`🔍 Testing Redis connection...`);

// Redis clients with optimized settings
const publisherOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  lazyConnect: false,
  enableOfflineQueue: true,
  family: 4,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 10000,
  retryDelayOnFailover: 100,
};

const subscriberOptions = {
  ...publisherOptions,
  // Subscriber-specific optimizations (no timeout for pub/sub commands)
  maxRetriesPerRequest: null,
};

const publisher = new Redis(publisherOptions);
const subscriber = new Redis(subscriberOptions);

// Tracking variables
const messageTimings = [];
let publishedCount = 0;
let receivedCount = 0;
let startTime = null;
let testStartTime = null;

// Statistics
const stats = {
  delays: [],
  publishTimes: [],
  receiveTimes: [],
  minDelay: Infinity,
  maxDelay: 0,
  totalDelay: 0,
};

function formatTime(timestamp) {
  return new Date(timestamp).toISOString().slice(-13, -1); // HH:MM:SS.mmm
}

function logMessage(type, messageId, timestamp, delay = null) {
  const time = formatTime(timestamp);
  const delayStr = delay !== null ? ` (delay: ${delay.toFixed(2)}ms)` : '';
  console.log(`${type} #${messageId.toString().padStart(3)} at ${time}${delayStr}`);
}

function calculateStats() {
  if (stats.delays.length === 0) return;

  stats.minDelay = Math.min(...stats.delays);
  stats.maxDelay = Math.max(...stats.delays);
  stats.totalDelay = stats.delays.reduce((sum, delay) => sum + delay, 0);
  
  const avgDelay = stats.totalDelay / stats.delays.length;
  const sortedDelays = [...stats.delays].sort((a, b) => a - b);
  const p50 = sortedDelays[Math.floor(sortedDelays.length * 0.5)];
  const p95 = sortedDelays[Math.floor(sortedDelays.length * 0.95)];
  const p99 = sortedDelays[Math.floor(sortedDelays.length * 0.99)];

  console.log(`\n📈 PERFORMANCE STATISTICS`);
  console.log(`════════════════════════════════════════`);
  console.log(`📦 Messages: ${receivedCount}/${publishedCount}`);
  console.log(`⏱️  Avg Delay: ${avgDelay.toFixed(2)}ms`);
  console.log(`🚀 Min Delay: ${stats.minDelay.toFixed(2)}ms`);
  console.log(`🐌 Max Delay: ${stats.maxDelay.toFixed(2)}ms`);
  console.log(`📊 P50: ${p50.toFixed(2)}ms`);
  console.log(`📊 P95: ${p95.toFixed(2)}ms`);
  console.log(`📊 P99: ${p99.toFixed(2)}ms`);
  
  const totalTestTime = performance.now() - testStartTime;
  const throughput = (receivedCount / totalTestTime) * 1000;
  console.log(`🔄 Throughput: ${throughput.toFixed(2)} messages/sec`);
  
  // Health assessment
  console.log(`\n🏥 HEALTH ASSESSMENT`);
  console.log(`════════════════════════════════════════`);
  if (avgDelay < 10) {
    console.log(`✅ EXCELLENT: Average delay < 10ms`);
  } else if (avgDelay < 50) {
    console.log(`✨ GOOD: Average delay < 50ms`);
  } else if (avgDelay < 200) {
    console.log(`⚠️  SLOW: Average delay ${avgDelay.toFixed(2)}ms (should be < 50ms)`);
  } else {
    console.log(`🚨 VERY SLOW: Average delay ${avgDelay.toFixed(2)}ms (investigate immediately)`);
  }

  if (stats.maxDelay > 1000) {
    console.log(`🚨 HIGH LATENCY SPIKES: Max delay ${stats.maxDelay.toFixed(2)}ms`);
  }

  if (receivedCount < publishedCount) {
    console.log(`💥 MESSAGE LOSS: ${publishedCount - receivedCount} messages lost`);
  }
}

// Simple connection setup
async function initializeConnections() {
  try {
    console.log('🔗 Connecting to Redis...');
    
    // Wait for both connections to be ready
    await Promise.all([
      new Promise((resolve, reject) => {
        publisher.on('ready', resolve);
        publisher.on('error', reject);
      }),
      new Promise((resolve, reject) => {
        subscriber.on('ready', resolve);  
        subscriber.on('error', reject);
      })
    ]);
    
    console.log('✅ Redis connections established');
    
    // Set up subscription
    const count = await subscriber.subscribe(TEST_CHANNEL);
    console.log(`✅ Subscribed to ${TEST_CHANNEL} (${count} total subscriptions)`);
    
    // Start the test
    startTest();
    
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
    console.log('💡 Make sure Redis is running: yarn redis:up');
    process.exit(1);
  }
}

// Initialize
initializeConnections();

subscriber.on('message', (channel, message) => {
  const receiveTime = performance.now();
  const data = JSON.parse(message);
  const publishTime = data.timestamp;
  const messageId = data.id;
  const delay = receiveTime - publishTime;
  
  receivedCount++;
  stats.delays.push(delay);
  stats.receiveTimes.push(receiveTime);
  
  logMessage('📨 RECV', messageId, receiveTime, delay);
  
  // Check if test is complete
  if (receivedCount >= MESSAGE_COUNT) {
    setTimeout(() => {
      calculateStats();
      cleanup();
    }, 100); // Small delay to ensure all messages are processed
  }
});

subscriber.on('error', (err) => {
  console.error('❌ Subscriber error:', err.message);
});

publisher.on('error', (err) => {
  console.error('❌ Publisher error:', err.message);
});

function startTest() {
  console.log(`\n🎬 Starting test in 1 second...`);
  setTimeout(() => {
    testStartTime = performance.now();
    console.log(`📝 DETAILED LOG (times in HH:MM:SS.mmm format)`);
    console.log(`════════════════════════════════════════`);
    publishMessages();
  }, 1000);
}

function publishMessages() {
  const interval = setInterval(() => {
    if (publishedCount >= MESSAGE_COUNT) {
      clearInterval(interval);
      return;
    }
    
    publishedCount++;
    const publishTime = performance.now();
    const message = JSON.stringify({
      id: publishedCount,
      timestamp: publishTime,
      data: `Test message ${publishedCount}`
    });
    
    stats.publishTimes.push(publishTime);
    
    publisher.publish(TEST_CHANNEL, message).then(() => {
      logMessage('📤 SENT', publishedCount, publishTime);
    }).catch((err) => {
      console.error(`❌ Publish failed for message ${publishedCount}:`, err.message);
    });
    
  }, PUBLISH_INTERVAL);
}

function cleanup() {
  console.log(`\n🧹 Cleaning up...`);
  subscriber.disconnect();
  publisher.disconnect();
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\n⏹️  Test interrupted by user`);
  calculateStats();
  cleanup();
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught exception:', err.message);
  cleanup();
});

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node test-redis-pubsub.js [message_count] [interval_ms]

Arguments:
  message_count   Number of messages to send (default: 50)
  interval_ms     Milliseconds between messages (default: 100)

Environment Variables:
  REDIS_HOST      Redis host (default: localhost)
  REDIS_PORT      Redis port (default: 6379)
  REDIS_PASSWORD  Redis password (loaded from .env.local)

Examples:
  node test-redis-pubsub.js              # Send 50 messages, 100ms apart
  node test-redis-pubsub.js 100 50       # Send 100 messages, 50ms apart
  node test-redis-pubsub.js 20 1000      # Send 20 messages, 1s apart
  `);
  process.exit(0);
}