import { S3Client } from "@aws-sdk/client-s3";
import { S3Config, S3ServiceConfig } from "../types/s3.types";

export class S3ConfigService {
  private config: S3Config;
  private client: S3Client | null = null;

  constructor(config?: Partial<S3Config>) {
    this.config = this.loadS3Config(config);
  }

  private loadS3Config(overrideConfig?: Partial<S3Config>): S3Config {
    const bucketEnv = process.env.AWS_S3_BUCKET || "";
    const [bucketName] = bucketEnv.split("/");

    const defaultConfig: S3Config = {
      region: process.env.AWS_REGION || "us-east-1",
      bucketName,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    };

    // Apply environment-specific configurations
    if (process.env.AWS_S3_ENDPOINT) {
      defaultConfig.endpoint = process.env.AWS_S3_ENDPOINT;
    }

    if (process.env.AWS_S3_FORCE_PATH_STYLE === "true") {
      defaultConfig.forcePathStyle = true;
    }

    // Merge with override config
    return { ...defaultConfig, ...overrideConfig };
  }

  public createClient(): S3Client {
    if (this.client) {
      return this.client;
    }

    this.validateConfig();

    const clientConfig: any = {
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    };

    // Apply optional configurations
    if (this.config.endpoint) {
      clientConfig.endpoint = this.config.endpoint;
    }

    if (this.config.forcePathStyle) {
      clientConfig.forcePathStyle = this.config.forcePathStyle;
    }

    this.client = new S3Client(clientConfig);
    console.log(
      `✅ S3 client configured for region: ${this.config.region}, bucket: ${this.config.bucketName}`
    );

    return this.client;
  }

  public getServiceConfig(): S3ServiceConfig {
    const client = this.createClient();

    return {
      client,
      bucketName: this.config.bucketName,
      region: this.config.region,
    };
  }

  public getConfig(): S3Config {
    return { ...this.config };
  }

  public validateConfig(): void {
    const requiredFields = [
      "bucketName",
      "accessKeyId",
      "secretAccessKey",
      "region",
    ];
    const missingFields = requiredFields.filter(
      (field) => !this.config[field as keyof S3Config]
    );

    if (missingFields.length > 0) {
      throw new Error(
        `AWS S3 configuration is incomplete. Missing: ${missingFields.join(
          ", "
        )}. ` +
          "Please check environment variables: AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION"
      );
    }

    if (!this.config.bucketName) {
      throw new Error(
        "AWS S3 bucket name is required. Please set AWS_S3_BUCKET environment variable."
      );
    }

    if (!this.config.accessKeyId) {
      throw new Error(
        "AWS Access Key ID is required. Please set AWS_ACCESS_KEY_ID environment variable."
      );
    }

    if (!this.config.secretAccessKey) {
      throw new Error(
        "AWS Secret Access Key is required. Please set AWS_SECRET_ACCESS_KEY environment variable."
      );
    }

    if (!this.config.region) {
      throw new Error(
        "AWS region is required. Please set AWS_REGION environment variable."
      );
    }
  }

  public isConfigured(): boolean {
    try {
      this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }

  public getBucketName(): string {
    return this.config.bucketName;
  }

  public getRegion(): string {
    return this.config.region;
  }

  public getEndpoint(): string | undefined {
    return this.config.endpoint;
  }

  public isForcePathStyle(): boolean {
    return this.config.forcePathStyle || false;
  }

  public updateConfig(newConfig: Partial<S3Config>): void {
    this.config = { ...this.config, ...newConfig };
    // Reset client to force recreation with new config
    this.client = null;
  }

  public getConfigurationStatus(): {
    configured: boolean;
    bucketName: string;
    region: string;
    hasEndpoint: boolean;
    forcePathStyle: boolean;
    hasCredentials: boolean;
  } {
    return {
      configured: this.isConfigured(),
      bucketName: this.config.bucketName,
      region: this.config.region,
      hasEndpoint: !!this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle || false,
      hasCredentials: !!(
        this.config.accessKeyId && this.config.secretAccessKey
      ),
    };
  }
}
