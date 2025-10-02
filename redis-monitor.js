#!/usr/bin/env node

/**
 * Redis Pub/Sub Performance Monitor
 * Helps debug bottlenecks in Redis pub/sub message delivery
 */

const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const MONITOR_CHANNEL = process.env.MONITOR_CHANNEL || '*'; // Monitor all channels by default
const LOG_FILE = path.join(__dirname, 'logs', 'redis-pubsub-monitor.log');

// Create Redis clients
const monitorClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryDelayOnFailover: 100,
});

const subscriberClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryDelayOnFailover: 100,
});

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Message timing tracking
const messageTimings = new Map();
let messageCount = 0;
let lastMessageTime = Date.now();

// Start monitoring Redis commands
async function startMonitoring() {
  try {
    log('Starting Redis Pub/Sub Performance Monitor...');
    log(`Monitoring Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    log(`Channel pattern: ${MONITOR_CHANNEL}`);
    log(`Log file: ${LOG_FILE}`);
    
    // Enable Redis MONITOR mode to see all commands
    await monitorClient.monitor();
    
    monitorClient.on('monitor', (time, args, source, database) => {
      const command = args[0]?.toLowerCase();
      const currentTime = Date.now();
      
      if (command === 'publish') {
        const channel = args[1];
        const messageId = `${channel}:${currentTime}`;
        messageTimings.set(messageId, { 
          publishTime: currentTime,
          channel: channel,
          source: source 
        });
        
        log(`📤 PUBLISH: Channel="${channel}" Source="${source}" Time=${currentTime}`);
      }
      
      if (command === 'subscribe' || command === 'psubscribe') {
        const channel = args[1];
        log(`📥 SUBSCRIBE: Channel="${channel}" Source="${source}" Time=${currentTime}`);
      }
    });
    
    // Subscribe to channels to measure delivery time
    if (MONITOR_CHANNEL === '*') {
      await subscriberClient.psubscribe('*');
    } else {
      await subscriberClient.subscribe(MONITOR_CHANNEL);
    }
    
    subscriberClient.on('pmessage', (pattern, channel, message) => {
      handleMessage(channel, message);
    });
    
    subscriberClient.on('message', (channel, message) => {
      handleMessage(channel, message);
    });
    
    function handleMessage(channel, message) {
      const receiveTime = Date.now();
      const timeSinceLastMessage = receiveTime - lastMessageTime;
      messageCount++;
      
      log(`📨 RECEIVED: Channel="${channel}" Count=${messageCount} TimeSinceLastMessage=${timeSinceLastMessage}ms ReceiveTime=${receiveTime}`);
      
      // Try to find corresponding publish timing
      const possibleKeys = Array.from(messageTimings.keys()).filter(key => key.startsWith(channel));
      if (possibleKeys.length > 0) {
        const latestKey = possibleKeys[possibleKeys.length - 1];
        const timing = messageTimings.get(latestKey);
        if (timing) {
          const latency = receiveTime - timing.publishTime;
          log(`⚡ LATENCY: Channel="${channel}" PublishToReceive=${latency}ms`);
          messageTimings.delete(latestKey);
        }
      }
      
      lastMessageTime = receiveTime;
      
      // Check for consistent 1-second delays (your reported issue)
      if (messageCount > 1 && Math.abs(timeSinceLastMessage - 1000) < 100) {
        log(`🚨 BOTTLENECK DETECTED: Consistent ~1s delay between messages (${timeSinceLastMessage}ms)`);
      }
    }
    
    // Periodic stats
    setInterval(() => {
      const stats = {
        messageCount,
        pendingPublishes: messageTimings.size,
        avgTimeBetweenMessages: messageCount > 1 ? (Date.now() - (Date.now() - (messageCount * 1000))) / messageCount : 0
      };
      
      log(`📊 STATS: Messages=${stats.messageCount} PendingPublishes=${stats.pendingPublishes}`);
      
      // Clean up old timings (older than 10 seconds)
      const cutoffTime = Date.now() - 10000;
      for (const [key, timing] of messageTimings.entries()) {
        if (timing.publishTime < cutoffTime) {
          messageTimings.delete(key);
        }
      }
    }, 5000);
    
  } catch (error) {
    log(`❌ Error starting monitor: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down Redis monitor...');
  monitorClient.disconnect();
  subscriberClient.disconnect();
  process.exit(0);
});

// Start monitoring
startMonitoring().catch(error => {
  console.error('Failed to start monitoring:', error);
  process.exit(1);
});