#!/usr/bin/env node

const Redis = require('ioredis');
const { RedisPubSub } = require('graphql-redis-subscriptions');
const { performance } = require('perf_hooks');

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

console.log(`🧪 GraphQL-Redis-Subscriptions Performance Test`);
console.log(`📍 Redis: ${REDIS_HOST}:${REDIS_PORT}`);
console.log(`════════════════════════════════════════`);

// Set up Redis clients exactly like your pubsub.ts
const redisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  connectTimeout: 5000,
  lazyConnect: false,
  maxRetriesPerRequest: null,
  retryDelayOnFailover: false,
  enableOfflineQueue: false,
  enableReadyCheck: true,
};

const publisher = new Redis(redisOptions);
const subscriber = new Redis(redisOptions);

const pubsub = new RedisPubSub({
  publisher,
  subscriber,
});

const timings = [];

async function testGraphQLRedisSubscriptions() {
  try {
    console.log('🔗 Connecting to Redis...');
    
    // Wait for connections
    await new Promise((resolve, reject) => {
      let connected = 0;
      const checkConnection = () => {
        connected++;
        if (connected === 2) resolve();
      };
      
      publisher.on('ready', checkConnection);
      subscriber.on('ready', checkConnection);
      publisher.on('error', reject);
      subscriber.on('error', reject);
    });
    
    console.log('✅ Redis connections ready');
    
    // Set up async iterator
    const TEST_TOPIC = 'SUBSCRIPTION_EVENT';
    const asyncIterator = pubsub.asyncIterator(TEST_TOPIC);
    
    console.log('✅ Async iterator created');
    console.log('🎬 Starting message flow...\n');
    
    // Start consuming messages
    const consumeMessages = async () => {
      let messageCount = 0;
      const maxMessages = 10;
      
      for await (const payload of asyncIterator) {
        const receiveTime = performance.now();
        messageCount++;
        
        // Debug the payload structure
        console.log(`🔍 Payload keys: ${Object.keys(payload)}`);
        console.log(`🔍 Payload[${TEST_TOPIC}]: ${JSON.stringify(payload[TEST_TOPIC])}`);
        console.log(`🔍 Raw payload: ${JSON.stringify(payload)}`);
        
        try {
          // Try different payload structures
          let messageData;
          if (payload[TEST_TOPIC]) {
            messageData = typeof payload[TEST_TOPIC] === 'string' 
              ? JSON.parse(payload[TEST_TOPIC])
              : payload[TEST_TOPIC];
          } else if (typeof payload === 'string') {
            messageData = JSON.parse(payload);
          } else {
            messageData = payload;
          }
          
          const publishTime = messageData.timestamp;
          const delay = receiveTime - publishTime;
          
          timings.push({
            messageId: messageData.id,
            publishTime,
            receiveTime,  
            delay
          });
          
          console.log(`📨 RECV #${messageData.id} - delay: ${delay.toFixed(2)}ms`);
          
          if (messageCount >= maxMessages) {
            break;
          }
        } catch (err) {
          console.log(`📨 RECV #${messageCount} - parsing error: ${err.message}`);
          console.log(`🔍 Failed payload: ${JSON.stringify(payload)}`);
        }
      }
    };
    
    // Start consuming in background
    const consumerPromise = consumeMessages();
    
    // Wait a bit for consumer to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Publish messages
    for (let i = 1; i <= 10; i++) {
      const publishTime = performance.now();
      const message = JSON.stringify({
        id: i,
        timestamp: publishTime,
        data: `Test message ${i}`
      });
      
      console.log(`📤 SENT #${i}`);
      await pubsub.publish(TEST_TOPIC, message);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Wait for messages to be processed
    await Promise.race([
      consumerPromise,
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
    
    // Calculate stats
    if (timings.length > 0) {
      const delays = timings.map(t => t.delay);
      const avgDelay = delays.reduce((sum, delay) => sum + delay, 0) / delays.length;
      const minDelay = Math.min(...delays);
      const maxDelay = Math.max(...delays);
      
      console.log(`\n📈 GRAPHQL-REDIS-SUBSCRIPTIONS PERFORMANCE`);
      console.log(`════════════════════════════════════════`);
      console.log(`📦 Messages: ${timings.length}/10`);
      console.log(`⏱️  Avg Delay: ${avgDelay.toFixed(2)}ms`);
      console.log(`🚀 Min Delay: ${minDelay.toFixed(2)}ms`);
      console.log(`🐌 Max Delay: ${maxDelay.toFixed(2)}ms`);
      
      if (avgDelay > 500) {
        console.log(`🚨 MAJOR BOTTLENECK: ${avgDelay.toFixed(2)}ms - this is your 700ms issue!`);
        console.log(`💡 Problem is in graphql-redis-subscriptions or async iterator setup`);
      } else if (avgDelay > 100) {
        console.log(`⚠️  SIGNIFICANT DELAY: ${avgDelay.toFixed(2)}ms`);
        console.log(`💡 This could be contributing to your slowness`);
      } else if (avgDelay > 20) {
        console.log(`📝 MODERATE DELAY: ${avgDelay.toFixed(2)}ms`);
      } else {
        console.log(`✅ GOOD PERFORMANCE: ${avgDelay.toFixed(2)}ms delay`);
      }
    } else {
      console.log(`❌ No messages received through GraphQL Redis Subscriptions`);
      console.log(`💡 This suggests the async iterator isn't working properly`);
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
  } finally {
    console.log('\n🧹 Disconnecting...');
    publisher.disconnect();
    subscriber.disconnect();
  }
}

testGraphQLRedisSubscriptions().catch(err => {
  console.error('💥 Test crashed:', err.message);
  process.exit(1);
});