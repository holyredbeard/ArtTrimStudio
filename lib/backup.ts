import { filedb, ImageRecord } from './filedb';

export async function exportDatabaseToFile(rootHandle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const allImages = await filedb.toArray();
    const backup = {
      version: 1,
      timestamp: Date.now(),
      imageCount: allImages.length,
      images: allImages
    };
    
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    
    const backupHandle = await rootHandle.getFileHandle('.vibe-backup.json', { create: true });
    const writable = await backupHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    
    console.log(`Backup saved: ${allImages.length} images`);
  } catch (error) {
    console.error('Failed to export database:', error);
    throw error;
  }
}

export async function importDatabaseFromFile(rootHandle: FileSystemDirectoryHandle): Promise<number> {
  try {
    const backupHandle = await rootHandle.getFileHandle('.vibe-backup.json');
    const file = await backupHandle.getFile();
    const text = await file.text();
    const backup = JSON.parse(text);
    
    if (!backup.images || !Array.isArray(backup.images)) {
      throw new Error('Invalid backup file format');
    }
    
    // Clear existing data and import
    await filedb.clear();
    await filedb.bulkPut(backup.images);
    
    console.log(`Restored ${backup.images.length} images from backup`);
    return backup.images.length;
  } catch (error) {
    console.error('Failed to import database:', error);
    throw error;
  }
}

export async function checkForBackup(rootHandle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await rootHandle.getFileHandle('.vibe-backup.json');
    return true;
  } catch {
    return false;
  }
}

export async function getBackupInfo(rootHandle: FileSystemDirectoryHandle): Promise<{ imageCount: number; timestamp: number } | null> {
  try {
    const backupHandle = await rootHandle.getFileHandle('.vibe-backup.json');
    const file = await backupHandle.getFile();
    const text = await file.text();
    const backup = JSON.parse(text);
    
    return {
      imageCount: backup.imageCount || backup.images?.length || 0,
      timestamp: backup.timestamp || file.lastModified
    };
  } catch {
    return null;
  }
}
