import { filedb, ImageRecord } from './filedb';
import { analyzeImage } from './analyzer';
import { generateThumbnail, saveThumbnail } from './thumbnail';
import { matchTagsFromFilename } from './tagmatcher';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface ScanProgress {
  total: number;
  processed: number;
  newImages: number;
  status: string;
}

export type ProgressCallback = (progress: ScanProgress) => void;

async function* walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ''
): AsyncGenerator<{ file: FileSystemFileHandle; relativePath: string }> {
  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    
    if (entry.name === '._thumbnails') continue;
    
    if (entry.kind === 'file') {
      const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        yield { file: entry as FileSystemFileHandle, relativePath: entryPath };
      }
    } else if (entry.kind === 'directory') {
      yield* walkDirectory(entry as FileSystemDirectoryHandle, entryPath);
    }
  }
}

export async function scanFolder(
  rootHandle: FileSystemDirectoryHandle,
  onProgress?: ProgressCallback,
  forceRescan: boolean = false
): Promise<{ totalImages: number; newImages: number }> {
  await filedb.setRootHandle(rootHandle);
  const existingImages = await filedb.toArray();
  const existingMap = new Map(
    existingImages.map(img => [img.relativePath, img])
  );

  const foundFiles: Array<{ file: FileSystemFileHandle; relativePath: string }> = [];
  
  for await (const entry of walkDirectory(rootHandle)) {
    foundFiles.push(entry);
  }

  const total = foundFiles.length;
  let processed = 0;
  let newImages = 0;

  onProgress?.({
    total,
    processed,
    newImages,
    status: 'Scanning files...'
  });

  const toProcess: Array<{ file: FileSystemFileHandle; relativePath: string }> = [];

  for (const { file, relativePath } of foundFiles) {
    const fileObj = await file.getFile();
    const existing = existingMap.get(relativePath);

    if (forceRescan || !existing || existing.lastModified !== fileObj.lastModified) {
      toProcess.push({ file, relativePath });
    }
    
    existingMap.delete(relativePath);
  }

  const deletedPaths = Array.from(existingMap.keys());
  if (deletedPaths.length > 0) {
    await filedb.bulkDelete(deletedPaths);
  }

  for (let i = 0; i < toProcess.length; i++) {
    const { file, relativePath } = toProcess[i];
    
    try {
      const fileObj = await file.getFile();
      
      onProgress?.({
        total,
        processed,
        newImages,
        status: `Processing ${relativePath}...`
      });

      const analysis = await analyzeImage(fileObj);
      const thumbnailBlob = await generateThumbnail(fileObj);
      const thumbnailPath = await saveThumbnail(rootHandle, relativePath, thumbnailBlob);

      // Match tags from filename against master tag list
      const masterTags = await filedb.getMasterTags();
      const tags = matchTagsFromFilename(fileObj.name, masterTags);

      await filedb.put({
        relativePath,
        filename: fileObj.name,
        size: fileObj.size,
        lastModified: fileObj.lastModified,
        tags,
        aestheticScore: analysis.aestheticScore,
        qualityScore: analysis.qualityScore,
        totalScore: analysis.totalScore,
        dateAdded: Date.now(),
        thumbnailPath,
        status: 'unreviewed'
      });
      
      newImages++;
      processed++;

      // Force save every 100 images to ensure data is written to disk
      if (processed % 100 === 0) {
        try {
          await filedb.forceSave();
        } catch (error) {
          console.error('Force save failed:', error);
        }
      }

      if (processed % 10 === 0 || processed === toProcess.length) {
        onProgress?.({
          total,
          processed,
          newImages,
          status: `Processed ${processed} / ${toProcess.length} new images`
        });
      }
    } catch (error) {
      console.error(`Failed to process ${relativePath}:`, error);
      processed++;
    }
  }

  onProgress?.({
    total,
    processed,
    newImages,
    status: 'Scan complete!'
  });

  return { totalImages: total, newImages };
}
