// FILE-BASED DATABASE - Stores everything in .vibe-db.json in the root folder
// NO BROWSER STORAGE - REAL PERSISTENT DATABASE

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface ImageRecord {
  relativePath: string;
  filename: string;
  size: number;
  lastModified: number;
  tags: string[];
  aestheticScore: number;
  qualityScore: number;
  totalScore: number;
  dateAdded: number;
  thumbnailPath: string;
  status: 'keep' | 'discard' | 'unreviewed';
  reviewStatus?: 'keep' | 'upgrade' | 'discard' | 'fixed';
  chatHistory?: ChatMessage[];
}

interface DatabaseSchema {
  version: number;
  images: ImageRecord[];
  masterTags: string[];
  lastModified: number;
}

const DB_FILENAME = '.vibe-db.json';

class FileDatabase {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private cache: Map<string, ImageRecord> = new Map();
  private masterTags: string[] = [];
  private isDirty = false;

  async setRootHandle(handle: FileSystemDirectoryHandle) {
    this.rootHandle = handle;
    await this.load();
  }

  private async load(): Promise<void> {
    if (!this.rootHandle) return;

    try {
      const fileHandle = await this.rootHandle.getFileHandle(DB_FILENAME);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data: DatabaseSchema = JSON.parse(text);

      this.cache.clear();
      for (const image of data.images) {
        this.cache.set(image.relativePath, image);
      }
      
      this.masterTags = data.masterTags || [];

      console.log(`Loaded ${this.cache.size} images and ${this.masterTags.length} tags from file database`);
    } catch (error) {
      // Database file doesn't exist yet - start fresh
      console.log('No existing database found, starting fresh');
      this.cache.clear();
    }
  }

  private async save(): Promise<void> {
    if (!this.rootHandle || !this.isDirty) return;

    const data: DatabaseSchema = {
      version: 1,
      images: Array.from(this.cache.values()),
      masterTags: this.masterTags,
      lastModified: Date.now()
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const fileHandle = await this.rootHandle.getFileHandle(DB_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    this.isDirty = false;
  }

  async put(image: ImageRecord): Promise<void> {
    this.cache.set(image.relativePath, image);
    this.isDirty = true;
    await this.save();
  }

  async bulkPut(images: ImageRecord[]): Promise<void> {
    for (const image of images) {
      this.cache.set(image.relativePath, image);
    }
    this.isDirty = true;
    await this.save();
  }

  async get(relativePath: string): Promise<ImageRecord | undefined> {
    return this.cache.get(relativePath);
  }

  async bulkGet(relativePaths: string[]): Promise<(ImageRecord | undefined)[]> {
    return relativePaths.map(path => this.cache.get(path));
  }

  async delete(relativePath: string): Promise<void> {
    this.cache.delete(relativePath);
    this.isDirty = true;
    await this.save();
  }

  async bulkDelete(relativePaths: string[]): Promise<void> {
    for (const path of relativePaths) {
      this.cache.delete(path);
    }
    this.isDirty = true;
    await this.save();
  }

  async update(relativePath: string, changes: Partial<ImageRecord>): Promise<void> {
    const existing = this.cache.get(relativePath);
    if (existing) {
      const updated = { ...existing, ...changes };
      this.cache.set(relativePath, updated);
      this.isDirty = true;
      await this.save();
    }
  }

  async toArray(): Promise<ImageRecord[]> {
    return Array.from(this.cache.values());
  }

  async count(): Promise<number> {
    return this.cache.size;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.isDirty = true;
    await this.save();
  }

  // Force save (for auto-backup during scanning)
  async forceSave(): Promise<void> {
    this.isDirty = true;
    await this.save();
  }

  // Master tag list operations
  async getMasterTags(): Promise<string[]> {
    return [...this.masterTags];
  }

  async addMasterTag(tag: string): Promise<void> {
    const normalized = tag.toLowerCase().trim();
    if (normalized && !this.masterTags.includes(normalized)) {
      this.masterTags.push(normalized);
      this.masterTags.sort();
      this.isDirty = true;
      await this.save();
    }
  }

  async removeMasterTag(tag: string): Promise<void> {
    const normalized = tag.toLowerCase().trim();
    const index = this.masterTags.indexOf(normalized);
    if (index > -1) {
      this.masterTags.splice(index, 1);
      this.isDirty = true;
      await this.save();
    }
  }

  async setMasterTags(tags: string[]): Promise<void> {
    this.masterTags = tags.map(t => t.toLowerCase().trim()).filter(t => t.length > 0);
    this.masterTags.sort();
    this.isDirty = true;
    await this.save();
  }
}

export const filedb = new FileDatabase();
