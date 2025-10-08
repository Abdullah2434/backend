/**
 * Test script for Video Avatar API with file upload functionality
 * Run with: node test-video-avatar-file-upload.js
 */

const BASE_URL = 'http://localhost:4000';
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testVideoAvatarFileUpload() {
  console.log('🧪 Testing Video Avatar API with File Upload\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${BASE_URL}/v2/video_avatar/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health Check:', healthData);
    console.log('');

    // Test 2: Create Video Avatar with File Upload
    console.log('2️⃣ Testing Create Video Avatar with File Upload...');
    
    // Create form data
    const formData = new FormData();
    formData.append('avatar_name', 'Test Avatar from File');
    formData.append('callback_id', 'test_callback_file_123');
    formData.append('callback_url', 'https://webhook.site/unique-id');
    
    // Add sample video files (you'll need to provide actual video files)
    // For testing, we'll use sample video URLs as fallback
    formData.append('training_footage_url', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    formData.append('consent_statement_url', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4');

    const createResponse = await fetch(`${BASE_URL}/v2/video_avatar`, {
      method: 'POST',
      headers: {
        'x-api-key': 'test-api-key' // This would be your actual API key
      },
      body: formData
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

// Test with actual file upload
async function testWithActualFiles() {
  console.log('\n🔍 Testing with Actual File Upload...\n');

  try {
    // Create sample video files for testing (you would replace these with actual video files)
    const sampleVideoPath1 = path.join(__dirname, 'sample_training.mp4');
    const sampleVideoPath2 = path.join(__dirname, 'sample_consent.mp4');

    // Check if sample files exist, if not, use URL fallback
    if (fs.existsSync(sampleVideoPath1) && fs.existsSync(sampleVideoPath2)) {
      console.log('📁 Using actual video files for upload...');
      
      const formData = new FormData();
      formData.append('avatar_name', 'Test Avatar with Files');
      formData.append('training_footage', fs.createReadStream(sampleVideoPath1));
      formData.append('consent_statement', fs.createReadStream(sampleVideoPath2));

      const response = await fetch(`${BASE_URL}/v2/video_avatar`, {
        method: 'POST',
        headers: {
          'x-api-key': 'test-api-key'
        },
        body: formData
      });

      const data = await response.json();
      console.log('✅ File Upload Response:', data);
    } else {
      console.log('📝 Sample video files not found, using URL fallback...');
      console.log('💡 To test with actual files, place sample video files in the project root:');
      console.log('   - sample_training.mp4');
      console.log('   - sample_consent.mp4');
    }

  } catch (error) {
    console.error('❌ File upload test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Video Avatar File Upload API Tests\n');
  console.log('Make sure the server is running on http://localhost:4000\n');
  
  await testVideoAvatarFileUpload();
  await testWithActualFiles();
  
  console.log('\n✨ Test suite completed!');
}

// Run the tests
runAllTests().catch(console.error);
