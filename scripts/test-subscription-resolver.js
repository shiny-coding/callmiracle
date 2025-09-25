#!/usr/bin/env node

const { performance } = require('perf_hooks');

// Mock logger function to simulate withContext
function mockWithContext(context) {
  return {
    info: (message, data) => {
      // Simulate logging overhead
      const logString = JSON.stringify({ message, ...data });
      // Simulate some processing time
      for (let i = 0; i < 100; i++) {
        logString.length; // Simple operation to simulate work
      }
    },
    warn: (message, data) => {
      const logString = JSON.stringify({ message, ...data });
      for (let i = 0; i < 100; i++) {
        logString.length;
      }
    }
  };
}

// Mock notification type
const NotificationType = {
  MessageReceived: 'MESSAGE_RECEIVED',
  MeetingInvitation: 'MEETING_INVITATION'
};

console.log(`🧪 GraphQL Subscription Resolver Performance Test`);
console.log(`════════════════════════════════════════════════`);

// Mock payload similar to your subscription resolver
function createMockPayload() {
  return {
    logger: {
      context: {
        requestId: 'test-request-123',
        path: '/graphql/subscription',
        userAgent: 'Test-Agent',
        ip: '127.0.0.1',
        userId: 'user-456',
        userName: 'TestUser'
      }
    },
    subscriberUserId: 'subscriber-789',
    subscriberUserName: 'SubscriberUser',
    notificationEvent: {
      type: NotificationType.MessageReceived,
      peerUserName: 'SenderUser',
      peerUserId: 'sender-123',
      messageText: 'This is a test message for performance testing',
      conversationId: 'conversation-456'
    }
  };
}

// Your current resolver logic (copy from subscriptions.ts)
async function currentResolverLogic(payload) {
  const startTime = performance.now();
  
  // Recreate logger from serialized context (functions don't survive Redis serialization)
  const logger = payload.logger.context ? mockWithContext(payload.logger.context) : mockWithContext({
    requestId: 'subscription-fallback',
    path: '/graphql/subscription', 
    userAgent: 'GraphQL-Subscription',
    ip: 'internal',
    userId: 'system',
    userName: 'System'
  });
  
  if (payload.notificationEvent) {
    if (payload.notificationEvent.type === NotificationType.MessageReceived) {
      logger.info('Resolving message notification event', {
        notificationType: payload.notificationEvent.type,
        senderName: payload.notificationEvent.peerUserName,
        senderId: payload.notificationEvent.peerUserId?.toString(),
        messageLength: payload.notificationEvent.messageText?.length,
        conversationId: payload.notificationEvent.conversationId?.toString(),
        subscriberUserId: payload.subscriberUserId,
        subscriberUserName: payload.subscriberUserName
      });
    } else {
      logger.info('Resolving meeting notification event', {
        notificationType: payload.notificationEvent.type,
        meetingId: payload.notificationEvent.meeting?._id?.toString(),
        peerUserName: payload.notificationEvent.peerUserName,
        peerUserId: payload.notificationEvent.peerUserId?.toString(),
        subscriberUserId: payload.subscriberUserId,
        subscriberUserName: payload.subscriberUserName
      });
    }
  } else if (payload.callEvent) {
    logger.info('Resolving call event', {
      callType: payload.callEvent.type,
      fromUserName: payload.callEvent.from?.name,
      fromUserId: payload.callEvent.from?._id?.toString(),
      targetUserId: payload.callEvent.userId?.toString(),
      callId: payload.callEvent.callId?.toString(),
      meetingId: payload.callEvent.meetingId?.toString(),
      subscriberUserId: payload.subscriberUserId,
      subscriberUserName: payload.subscriberUserName
    });
  } else if (payload.broadcastEvent) {
    // Not logging broadcast events because of the large number of subscribers
  } else {
    logger.warn('Resolving unknown subscription event', {
      payloadKeys: Object.keys(payload)
    });
  }
  
  const endTime = performance.now();
  return endTime - startTime;
}

// Optimized resolver logic (no logging)
async function optimizedResolverLogic(payload) {
  const startTime = performance.now();
  
  // Skip logger creation and logging entirely
  // Just return the payload as-is
  
  const endTime = performance.now();
  return endTime - startTime;
}

// Run performance tests
async function runTests() {
  const iterations = 1000;
  const mockPayload = createMockPayload();
  
  console.log(`📊 Testing with ${iterations} iterations...\n`);
  
  // Test current resolver
  console.log(`🔍 Testing CURRENT resolver logic...`);
  const currentTimes = [];
  
  for (let i = 0; i < iterations; i++) {
    try {
      const duration = await currentResolverLogic(mockPayload);
      currentTimes.push(duration);
    } catch (err) {
      console.error(`❌ Current resolver failed on iteration ${i}:`, err.message);
      break;
    }
  }
  
  // Test optimized resolver  
  console.log(`🚀 Testing OPTIMIZED resolver logic...`);
  const optimizedTimes = [];
  
  for (let i = 0; i < iterations; i++) {
    const duration = await optimizedResolverLogic(mockPayload);
    optimizedTimes.push(duration);
  }
  
  // Calculate statistics
  function calculateStats(times, name) {
    if (times.length === 0) return;
    
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const sorted = [...times].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    console.log(`\n📈 ${name} RESOLVER PERFORMANCE`);
    console.log(`════════════════════════════════════════`);
    console.log(`📊 Iterations: ${times.length}`);
    console.log(`⏱️  Avg Time: ${avg.toFixed(3)}ms`);
    console.log(`🚀 Min Time: ${min.toFixed(3)}ms`);
    console.log(`🐌 Max Time: ${max.toFixed(3)}ms`);
    console.log(`📊 P50: ${p50.toFixed(3)}ms`);
    console.log(`📊 P95: ${p95.toFixed(3)}ms`);
    console.log(`📊 P99: ${p99.toFixed(3)}ms`);
    
    return { avg, min, max, p50, p95, p99 };
  }
  
  const currentStats = calculateStats(currentTimes, 'CURRENT');
  const optimizedStats = calculateStats(optimizedTimes, 'OPTIMIZED');
  
  if (currentStats && optimizedStats) {
    const improvement = ((currentStats.avg - optimizedStats.avg) / currentStats.avg) * 100;
    
    console.log(`\n🎯 PERFORMANCE COMPARISON`);
    console.log(`════════════════════════════════════════`);
    console.log(`📉 Speed Improvement: ${improvement.toFixed(1)}% faster`);
    console.log(`⚡ Time Saved: ${(currentStats.avg - optimizedStats.avg).toFixed(3)}ms per message`);
    
    if (currentStats.avg > 10) {
      console.log(`🚨 BOTTLENECK DETECTED: Current resolver takes ${currentStats.avg.toFixed(2)}ms`);
      console.log(`💡 RECOMMENDATION: Optimize logging in subscription resolver`);
    } else if (currentStats.avg > 5) {
      console.log(`⚠️  SLOW: Current resolver takes ${currentStats.avg.toFixed(2)}ms`);
      console.log(`💡 SUGGESTION: Consider reducing logging overhead`);
    } else {
      console.log(`✅ FAST: Current resolver takes ${currentStats.avg.toFixed(2)}ms`);
    }
  }
}

// Run the tests
runTests().catch(err => {
  console.error('💥 Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});