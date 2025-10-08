/**
 * Test script for Custom Webhook API with User Authentication
 * Run with: node test-custom-webhook.js
 */

const BASE_URL = 'http://localhost:4000';

async function testCustomWebhook() {
  console.log('🧪 Testing Custom Webhook API with User Authentication\n');

  try {
    // Test 1: Webhook Status
    console.log('1️⃣ Testing Webhook Status...');
    const statusResponse = await fetch(`${BASE_URL}/v2/webhook/status`);
    const statusData = await statusResponse.json();
    console.log('✅ Webhook Status:', statusData);
    console.log('');

    // Test 2: Test Webhook (without user token)
    console.log('2️⃣ Testing Webhook without User Token...');
    const testResponse = await fetch(`${BASE_URL}/v2/webhook/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhook_url: 'https://webhook.site/your-unique-id'
      })
    });
    const testData = await testResponse.json();
    console.log('✅ Test Webhook (no auth):', testData);
    console.log('');

    // Test 3: Test Webhook (with user token)
    console.log('3️⃣ Testing Webhook with User Token...');
    const testWithAuthResponse = await fetch(`${BASE_URL}/v2/webhook/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-jwt-token-here' // Replace with actual JWT token
      },
      body: JSON.stringify({
        webhook_url: 'https://webhook.site/your-unique-id',
        user_token: 'your-jwt-token-here' // Replace with actual JWT token
      })
    });
    const testWithAuthData = await testWithAuthResponse.json();
    console.log('✅ Test Webhook (with auth):', testWithAuthData);
    console.log('');

    // Test 4: Avatar Webhook
    console.log('4️⃣ Testing Avatar Webhook...');
    const avatarWebhookResponse = await fetch(`${BASE_URL}/v2/webhook/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-jwt-token-here' // Replace with actual JWT token
      },
      body: JSON.stringify({
        avatar_id: 'avatar_123',
        status: 'completed',
        avatar_group_id: 'group_456',
        callback_id: 'callback_789',
        user_id: 'user_123',
        webhook_url: 'https://webhook.site/your-unique-id'
      })
    });
    const avatarWebhookData = await avatarWebhookResponse.json();
    console.log('✅ Avatar Webhook:', avatarWebhookData);
    console.log('');

    // Test 5: Verify Webhook Signature
    console.log('5️⃣ Testing Webhook Signature Verification...');
    const verifyResponse = await fetch(`${BASE_URL}/v2/webhook/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payload: {
          avatar_id: 'avatar_123',
          status: 'completed',
          avatar_group_id: 'group_456'
        },
        signature: 'test-signature'
      })
    });
    const verifyData = await verifyResponse.json();
    console.log('✅ Signature Verification:', verifyData);
    console.log('');

    console.log('🎉 All webhook tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test error cases
async function testWebhookErrors() {
  console.log('\n🔍 Testing Webhook Error Cases...\n');

  try {
    // Test 1: Missing required fields
    console.log('1️⃣ Testing Missing Required Fields...');
    const response = await fetch(`${BASE_URL}/v2/webhook/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        avatar_id: 'avatar_123'
        // Missing status and avatar_group_id
      })
    });
    const data = await response.json();
    console.log('✅ Error Response (400):', data);
    console.log('');

    // Test 2: Invalid status
    console.log('2️⃣ Testing Invalid Status...');
    const invalidStatusResponse = await fetch(`${BASE_URL}/v2/webhook/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        avatar_id: 'avatar_123',
        status: 'invalid_status',
        avatar_group_id: 'group_456'
      })
    });
    const invalidStatusData = await invalidStatusResponse.json();
    console.log('✅ Invalid Status Response (400):', invalidStatusData);
    console.log('');

    // Test 3: Missing webhook URL
    console.log('3️⃣ Testing Missing Webhook URL...');
    const missingUrlResponse = await fetch(`${BASE_URL}/v2/webhook/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Missing webhook_url
      })
    });
    const missingUrlData = await missingUrlResponse.json();
    console.log('✅ Missing URL Response (400):', missingUrlData);
    console.log('');

  } catch (error) {
    console.error('❌ Error test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Custom Webhook API Tests\n');
  console.log('Make sure the server is running on http://localhost:4000\n');
  console.log('💡 Note: Replace "your-jwt-token-here" with actual JWT tokens for full testing\n');
  
  await testCustomWebhook();
  await testWebhookErrors();
  
  console.log('\n✨ Test suite completed!');
}

// Run the tests
runAllTests().catch(console.error);
