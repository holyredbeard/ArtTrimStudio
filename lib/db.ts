import Dexie, { Table } from 'dexie';

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

export interface FolderHandle {
  id: string;
  handle: FileSystemDirectoryHandle;
  absolutePath?: string;
}

export class VibeLibraryDB extends Dexie {
  images!: Table<ImageRecord, string>;
  folderHandles!: Table<FolderHandle, string>;

  constructor() {
    super('VibeLibraryDB');
    this.version(1).stores({
      images: 'relativePath, filename, lastModified, aestheticScore, dateAdded',
      folderHandles: 'id',
    });
    this.version(2).stores({
      images: 'relativePath, filename, lastModified, aestheticScore, qualityScore, totalScore, dateAdded, status',
      folderHandles: 'id',
    }).upgrade(tx => {
      return tx.table('images').toCollection().modify(image => {
        image.qualityScore = image.qualityScore || 50;
        image.totalScore = image.totalScore || image.aestheticScore || 50;
        image.status = image.status || 'unreviewed';
      });
    });
    this.version(3).stores({
      images: 'relativePath, filename, lastModified, aestheticScore, qualityScore, totalScore, dateAdded, status, reviewStatus',
      folderHandles: 'id',
    }).upgrade(tx => {
      return tx.table('images').toCollection().modify(image => {
        image.reviewStatus = image.reviewStatus || undefined;
        image.chatHistory = image.chatHistory || [];
      });
    });
  }
}

export const db = new VibeLibraryDB();
