#!/usr/bin/env node

const Redis = require('ioredis');
const { RedisPubSub } = require('graphql-redis-subscriptions');
const { performance } = require('perf_hooks');

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const TEST_CHANNEL = 'full-pipeline-test';

console.log(`🔬 Full GraphQL Subscription Pipeline Test`);
console.log(`📍 Redis: ${REDIS_HOST}:${REDIS_PORT}`);
console.log(`════════════════════════════════════════`);

// Set up Redis clients like your app
const redisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  lazyConnect: false,
  enableOfflineQueue: true,
  family: 4,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 10000,
};

const publisher = new Redis(redisOptions);
const subscriber = new Redis(redisOptions);

// Create RedisPubSub like your app
const pubsub = new RedisPubSub({
  publisher,
  subscriber,
});

// Mock async iterator merger (simplified version of your mergeAsyncIterators)
async function* mergeAsyncIterators(iterators) {
  const promises = [];
  const resolves = [];
  let finished = 0;

  for (let i = 0; i < iterators.length; i++) {
    const iterator = iterators[i];
    const promise = new Promise(resolve => {
      resolves[i] = resolve;
    });
    promises.push(promise);

    (async () => {
      try {
        for await (const value of iterator) {
          resolves[i]({ value, done: false, index: i });
        }
        resolves[i]({ done: true, index: i });
        finished++;
      } catch (error) {
        resolves[i]({ error, done: true, index: i });
        finished++;
      }
    })();
  }

  while (finished < iterators.length) {
    const result = await Promise.race(promises);
    
    if (result.error) {
      throw result.error;
    }
    
    if (result.done) {
      promises[result.index] = new Promise(() => {}); // Never resolves
    } else {
      yield result.value;
      promises[result.index] = new Promise(resolve => {
        resolves[result.index] = resolve;
      });
    }
  }
}

// Track timing
const timings = [];
let messageCount = 0;
const MAX_MESSAGES = 20;

async function runTest() {
  try {
    console.log('🔗 Connecting to Redis...');
    
    // Wait for connections
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
    
    // Create async iterators like your subscription
    const userTopic = `${TEST_CHANNEL}:user1`;
    const globalTopic = `${TEST_CHANNEL}:ALL`;
    
    console.log('🎬 Setting up subscription pipeline...');
    
    const userIterator = pubsub.asyncIterator(userTopic);
    const globalIterator = pubsub.asyncIterator(globalTopic);
    
    // Add subscriber context like your app
    const addSubscriberContext = (iterator) => ({
      [Symbol.asyncIterator]: async function* () {
        for await (const payload of iterator) {
          const receiveTime = performance.now();
          const data = JSON.parse(payload.SUBSCRIPTION_EVENT || '{}');
          const publishTime = data.timestamp;
          const delay = receiveTime - publishTime;
          
          timings.push({
            messageId: data.id,
            publishTime,
            receiveTime,
            delay
          });
          
          console.log(`📨 RECV #${data.id} - delay: ${delay.toFixed(2)}ms`);
          
          yield {
            ...payload,
            subscriberUserId: 'user1',
            subscriberUserName: 'TestUser'
          };
        }
      }
    });
    
    const userIteratorWithContext = addSubscriberContext(userIterator);
    const globalIteratorWithContext = addSubscriberContext(globalIterator);
    
    // Merge iterators like your app
    const mergedIterator = mergeAsyncIterators([userIteratorWithContext, globalIteratorWithContext]);
    
    console.log('✅ Pipeline ready, starting test...\n');
    
    // Start consuming messages
    const consumeMessages = async () => {
      for await (const message of mergedIterator) {
        messageCount++;
        if (messageCount >= MAX_MESSAGES) {
          break;
        }
      }
    };
    
    // Start consuming in background
    const consumerPromise = consumeMessages();
    
    // Give consumer time to set up
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Publish messages
    console.log('📤 Publishing messages...\n');
    for (let i = 1; i <= MAX_MESSAGES; i++) {
      const publishTime = performance.now();
      const message = JSON.stringify({
        id: i,
        timestamp: publishTime,
        data: `Test message ${i}`
      });
      
      const topic = i % 2 === 0 ? globalTopic : userTopic;
      
      await pubsub.publish('SUBSCRIPTION_EVENT', message);
      console.log(`📤 SENT #${i} to ${topic.includes('ALL') ? 'GLOBAL' : 'USER'}`);
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Wait for all messages to be processed
    await Promise.race([
      consumerPromise,
      new Promise(resolve => setTimeout(resolve, 5000)) // 5s timeout
    ]);
    
    // Calculate statistics
    if (timings.length > 0) {
      const delays = timings.map(t => t.delay);
      const avgDelay = delays.reduce((sum, delay) => sum + delay, 0) / delays.length;
      const minDelay = Math.min(...delays);
      const maxDelay = Math.max(...delays);
      
      console.log(`\n📈 FULL PIPELINE PERFORMANCE`);
      console.log(`════════════════════════════════════════`);
      console.log(`📦 Messages: ${timings.length}/${MAX_MESSAGES}`);
      console.log(`⏱️  Avg Delay: ${avgDelay.toFixed(2)}ms`);
      console.log(`🚀 Min Delay: ${minDelay.toFixed(2)}ms`);
      console.log(`🐌 Max Delay: ${maxDelay.toFixed(2)}ms`);
      
      if (avgDelay > 100) {
        console.log(`🚨 PIPELINE BOTTLENECK: ${avgDelay.toFixed(2)}ms average delay`);
        console.log(`💡 The issue is in your GraphQL subscription pipeline`);
      } else if (avgDelay > 50) {
        console.log(`⚠️  PIPELINE SLOW: ${avgDelay.toFixed(2)}ms average delay`);
      } else {
        console.log(`✅ PIPELINE FAST: ${avgDelay.toFixed(2)}ms average delay`);
      }
    } else {
      console.log(`❌ No messages received - possible pipeline issue`);
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    console.log('\n🧹 Cleaning up...');
    publisher.disconnect();
    subscriber.disconnect();
  }
}

// Run the test
runTest().catch(err => {
  console.error('💥 Test crashed:', err.message);
  process.exit(1);
});