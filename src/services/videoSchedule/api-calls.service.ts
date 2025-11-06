export class VideoScheduleAPICalls {
  /**
   * Call Step 1: Create Video API endpoint (same as manual)
   */
  static async callCreateVideoAPI(data: any): Promise<any> {
    const baseUrl =
      process.env.API_BASE_URL || "https://backend.edgeairealty.com";
    const createVideoUrl = `${baseUrl}/api/video/create`;

    console.log("🌐 Making API call to create video...");
    console.log(`📋 URL: ${createVideoUrl}`);
    console.log(`📋 Method: POST`);
    console.log(`📋 Headers: Content-Type: application/json`);

    return new Promise<any>((resolve, reject) => {
      const https = require("https");
      const http = require("http");
      const url = require("url");
      const parsedUrl = url.parse(createVideoUrl);
      const postData = JSON.stringify(data);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const request = (parsedUrl.protocol === "https:" ? https : http).request(
        options,
        (res: any) => {
          let responseData = "";
          res.on("data", (chunk: any) => {
            responseData += chunk;
          });
          res.on("end", () => {
            console.log(
              `📋 Step 1: Create Video API Response Status: ${res.statusCode}`
            );
            console.log(
              `📋 Step 1: Create Video API Response Body:`,
              responseData
            );

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log("✅ Step 1: Create Video API called successfully");

              // Parse the response to extract enhanced content
              try {
                const response = JSON.parse(responseData);

                // Extract enhanced content from webhookResponse (URL-encoded)
                const webhookResponse = response.data?.webhookResponse;
                if (webhookResponse) {
                  const enhancedContent = {
                    hook: decodeURIComponent(webhookResponse.hook || "")
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                    body: decodeURIComponent(webhookResponse.body || "")
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                    conclusion: decodeURIComponent(
                      webhookResponse.conclusion || ""
                    )
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                  };
                  console.log(
                    "📋 Extracted enhanced content:",
                    enhancedContent
                  );
                  resolve(enhancedContent);
                } else {
                  console.warn("⚠️ No webhookResponse found in API response");
                  resolve(null);
                }
              } catch (parseError) {
                console.warn(
                  "⚠️ Could not parse enhanced content from response, using fallback"
                );
                resolve(null);
              }
            } else {
              console.error(
                `❌ Step 1: Create Video API failed with status ${res.statusCode}:`,
                responseData
              );
              reject(new Error(`Create Video API failed: ${res.statusCode}`));
            }
          });
        }
      );

      request.on("error", (error: any) => {
        console.error("❌ Step 1: Create Video API request failed:", error);
        console.error(`📋 Error details: ${error.message}`);
        console.error(`📋 Error code: ${error.code}`);
        reject(error);
      });

      request.write(postData);
      request.end();
    });
  }

  /**
   * Call Step 2: Generate Video API endpoint (same as manual)
   */
  static async callGenerateVideoAPI(data: any): Promise<void> {
    const baseUrl =
      process.env.API_BASE_URL || "https://backend.edgeairealty.com";
    const generateVideoUrl = `${baseUrl}/api/video/generate-video`;

    console.log("🌐 Making API call to generate video...");
    console.log(`📋 URL: ${generateVideoUrl}`);
    console.log(`📋 Method: POST`);
    console.log(`📋 Headers: Content-Type: application/json`);

    return new Promise<void>((resolve, reject) => {
      const https = require("https");
      const http = require("http");
      const url = require("url");
      const parsedUrl = url.parse(generateVideoUrl);
      const postData = JSON.stringify(data);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const request = (parsedUrl.protocol === "https:" ? https : http).request(
        options,
        (res: any) => {
          let responseData = "";
          res.on("data", (chunk: any) => {
            responseData += chunk;
          });
          res.on("end", () => {
            console.log(
              `📋 Step 2: Generate Video API Response Status: ${res.statusCode}`
            );
            console.log(
              `📋 Step 2: Generate Video API Response Body:`,
              responseData
            );

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log("✅ Step 2: Generate Video API called successfully");
              resolve();
            } else {
              console.error(
                `❌ Step 2: Generate Video API failed with status ${res.statusCode}:`,
                responseData
              );
              reject(new Error(`Generate Video API failed: ${res.statusCode}`));
            }
          });
        }
      );

      request.on("error", (error: any) => {
        console.error("❌ Step 2: Generate Video API request failed:", error);
        console.error(`📋 Error details: ${error.message}`);
        console.error(`📋 Error code: ${error.code}`);
        reject(error);
      });

      request.write(postData);
      request.end();
    });
  }

}

