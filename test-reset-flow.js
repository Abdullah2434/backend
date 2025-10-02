const axios = require("axios");

async function testResetFlow() {
  const baseURL = "http://localhost:4000";
  const email = "rannausama44455@gmail.com";

  console.log("\n=== Step 1: Request Password Reset ===");
  const forgotResponse = await axios.post(
    `${baseURL}/api/auth/forgot-password`,
    {
      email: email,
    }
  );
  console.log("Response:", forgotResponse.data);

  console.log("\n⚠️  Now check your server logs for the token output!");
  console.log("Look for: 🔑 Password reset token generated:");
  console.log("\nThen test the token with:");
  console.log(
    'curl "http://localhost:4000/api/auth/validate-reset-token?token=YOUR_TOKEN"'
  );
}

testResetFlow().catch(console.error);
