export interface StorageProvider {
  isConfigured(): boolean;
  uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<{ storageKey: string; url?: string }>;
  getDownloadUrl(storageKey: string): Promise<string>;
  deleteFile(storageKey: string): Promise<void>;
}

class LocalOrStagedStorageProvider implements StorageProvider {
  isConfigured(): boolean {
    // Returns false until real S3/GCS credentials are configured
    return !!process.env.S3_BUCKET && !!process.env.AWS_ACCESS_KEY_ID;
  }

  async uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<{ storageKey: string; url?: string }> {
    if (!this.isConfigured()) {
      // Generate unique staged storage key without pretending remote upload completed
      const stagedKey = `staged/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      return { storageKey: stagedKey };
    }
    // Remote object storage upload implementation will hook here
    const storageKey = `uploads/${Date.now()}-${filename}`;
    return { storageKey };
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    return `/api/v1/attachments/${encodeURIComponent(storageKey)}`;
  }

  async deleteFile(storageKey: string): Promise<void> {
    // Delete from storage provider
  }
}

export const storageProvider: StorageProvider = new LocalOrStagedStorageProvider();
