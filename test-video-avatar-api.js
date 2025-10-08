/**
 * Test script for Video Avatar API endpoints
 * Run with: node test-video-avatar-api.js
 */

const BASE_URL = 'http://localhost:4000';

async function testVideoAvatarAPI() {
  console.log('🧪 Testing Video Avatar API Endpoints\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${BASE_URL}/v2/video_avatar/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Check:', healthData);
    console.log('');

    // Test 2: Create Video Avatar
    console.log('2️⃣ Testing Create Video Avatar...');
    const createPayload = {
      training_footage_url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      consent_statement_url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      avatar_name: 'Test Avatar',
      callback_id: 'test_callback_123',
      callback_url: 'https://webhook.site/unique-id'
    };

    const createResponse = await fetch(`${BASE_URL}/v2/video_avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-api-key' // This would be your actual API key
      },
      body: JSON.stringify(createPayload)
    });

    const createData = await createResponse.json();
    console.log('✅ Create Avatar Response:', createData);
    console.log('');

    if (createData.avatar_id) {
      // Test 3: Check Avatar Status
      console.log('3️⃣ Testing Avatar Status Check...');
      const statusResponse = await fetch(`${BASE_URL}/v2/video_avatar/${createData.avatar_id}`);
      const statusData = await statusResponse.json();
      console.log('✅ Avatar Status:', statusData);
      console.log('');

      // Test 4: Get Avatars by Group
      console.log('4️⃣ Testing Get Avatars by Group...');
      const groupResponse = await fetch(`${BASE_URL}/v2/video_avatar/group/${createData.avatar_group_id}`);
      const groupData = await groupResponse.json();
      console.log('✅ Group Avatars:', groupData);
      console.log('');

      // Test 5: Delete Avatar (cleanup)
      console.log('5️⃣ Testing Delete Avatar...');
      const deleteResponse = await fetch(`${BASE_URL}/v2/video_avatar/${createData.avatar_id}`, {
        method: 'DELETE'
      });
      const deleteData = await deleteResponse.json();
      console.log('✅ Delete Avatar:', deleteData);
      console.log('');
    }

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test error cases
async function testErrorCases() {
  console.log('\n🔍 Testing Error Cases...\n');

  try {
    // Test 1: Missing required fields
    console.log('1️⃣ Testing Missing Required Fields...');
    const invalidPayload = {
      avatar_name: 'Test Avatar'
      // Missing training_footage_url and consent_statement_url
    };

    const response = await fetch(`${BASE_URL}/v2/video_avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-api-key'
      },
      body: JSON.stringify(invalidPayload)
    });

    const data = await response.json();
    console.log('✅ Error Response (400):', data);
    console.log('');

    // Test 2: Invalid Avatar ID
    console.log('2️⃣ Testing Invalid Avatar ID...');
    const statusResponse = await fetch(`${BASE_URL}/v2/video_avatar/invalid_id`);
    const statusData = await statusResponse.json();
    console.log('✅ Not Found Response (404):', statusData);
    console.log('');

  } catch (error) {
    console.error('❌ Error test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Video Avatar API Tests\n');
  console.log('Make sure the server is running on http://localhost:4000\n');
  
  await testVideoAvatarAPI();
  await testErrorCases();
  
  console.log('\n✨ Test suite completed!');
}

// Run the tests
runAllTests().catch(console.error);
