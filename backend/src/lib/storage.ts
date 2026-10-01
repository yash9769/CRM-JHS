import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageProvider {
  isConfigured(): boolean;
  uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<{ storageKey: string; url?: string }>;
  getDownloadUrl(storageKey: string): Promise<string>;
  deleteFile(storageKey: string): Promise<void>;
}

// S3-compatible object storage (works with AWS S3 and S3-compatible providers
// such as BharathCloud B3 — set S3_ENDPOINT for a non-AWS provider).
class S3StorageProvider implements StorageProvider {
  private client: S3Client | null = null;
  private bucket = process.env.S3_BUCKET || "";

  isConfigured(): boolean {
    return !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID && !!process.env.S3_SECRET_ACCESS_KEY;
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    this.client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    return this.client;
  }

  async uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<{ storageKey: string; url?: string }> {
    if (!this.isConfigured()) {
      // Object storage isn't configured in this environment — stage the key so
      // attachment metadata can still be recorded, but no bytes are stored.
      const stagedKey = `staged/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      return { storageKey: stagedKey };
    }
    const storageKey = `uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );
    return { storageKey };
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    if (!this.isConfigured() || storageKey.startsWith("staged/")) {
      // No real object was ever stored for this key.
      throw new Error("This attachment was uploaded before object storage was configured and cannot be downloaded.");
    }
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: 300 }
    );
  }

  async deleteFile(storageKey: string): Promise<void> {
    if (!this.isConfigured() || storageKey.startsWith("staged/")) return;
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }
}

export const storageProvider: StorageProvider = new S3StorageProvider();
