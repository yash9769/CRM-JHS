import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageProvider {
  uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<{ storageKey: string }>;
  isLocalKey(storageKey: string): boolean;
  localFilePath(storageKey: string): string;
  getDownloadUrl(storageKey: string): Promise<string>;
  deleteFile(storageKey: string): Promise<void>;
}

const LOCAL_PREFIX = "local/";

// Files go to S3-compatible object storage (AWS S3, or BharathCloud B3 via
// S3_ENDPOINT) when it's configured and reachable. Otherwise -- not configured,
// or the upload to it fails -- they're written to the backend's own disk under
// UPLOAD_DIR (a Docker volume in production, so they survive redeploys), so an
// upload never fails just because object storage is down or not set up yet.
class StorageService implements StorageProvider {
  private client: S3Client | null = null;
  private bucket = process.env.S3_BUCKET || "";
  private uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");

  private s3Configured(): boolean {
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

  private safeName(filename: string): string {
    return `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  }

  async uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<{ storageKey: string }> {
    if (this.s3Configured()) {
      const storageKey = `uploads/${this.safeName(filename)}`;
      try {
        await this.getClient().send(
          new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: fileBuffer, ContentType: mimeType })
        );
        return { storageKey };
      } catch (err) {
        console.warn("[storage] object storage upload failed, saving to local disk instead:", (err as Error).message);
      }
    }
    const storageKey = `${LOCAL_PREFIX}${this.safeName(filename)}`;
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.writeFile(this.localFilePath(storageKey), fileBuffer);
    return { storageKey };
  }

  isLocalKey(storageKey: string): boolean {
    return storageKey.startsWith(LOCAL_PREFIX);
  }

  localFilePath(storageKey: string): string {
    const resolved = path.resolve(this.uploadDir, path.basename(storageKey.slice(LOCAL_PREFIX.length)));
    if (!resolved.startsWith(this.uploadDir + path.sep)) throw new Error("Invalid storage key");
    return resolved;
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    if (!this.s3Configured() || storageKey.startsWith("staged/")) {
      throw new Error("This attachment was uploaded before file storage was set up and cannot be downloaded.");
    }
    return getSignedUrl(this.getClient(), new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }), { expiresIn: 300 });
  }

  async deleteFile(storageKey: string): Promise<void> {
    if (this.isLocalKey(storageKey)) {
      await fs.unlink(this.localFilePath(storageKey)).catch(() => {});
      return;
    }
    if (!this.s3Configured() || storageKey.startsWith("staged/")) return;
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }
}

export const storageProvider: StorageProvider = new StorageService();
