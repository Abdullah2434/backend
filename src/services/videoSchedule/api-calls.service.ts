export class VideoScheduleAPICalls {
  /**
   * Call Step 1: Create Video API endpoint (same as manual)
   */
  static async callCreateVideoAPI(data: any): Promise<any> {
    const baseUrl =
      process.env.API_BASE_URL || "https://backend.edgeairealty.com";
    const createVideoUrl = `${baseUrl}/api/video/create`;

   

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
          

            if (res.statusCode >= 200 && res.statusCode < 300) {
  

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
                 
                  resolve(enhancedContent);
                } else {

                  resolve(null);
                }
              } catch (parseError) {
              
                resolve(null);
              }
            } else {
            
              reject(new Error(`Create Video API failed: ${res.statusCode}`));
            }
          });
        }
      );

      request.on("error", (error: any) => {
  
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
      

            if (res.statusCode >= 200 && res.statusCode < 300) {
      
              resolve();
            } else {
        
              reject(new Error(`Generate Video API failed: ${res.statusCode}`));
            }
          });
        }
      );

      request.on("error", (error: any) => {

        reject(error);
      });

      request.write(postData);
      request.end();
    });
  }

}

