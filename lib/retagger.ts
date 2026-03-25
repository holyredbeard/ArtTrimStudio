// Re-tag all images based on filename matching against master tag list

import { filedb } from './filedb';
import { matchTagsFromFilename } from './tagmatcher';

export interface RetagProgress {
  total: number;
  processed: number;
  status: string;
}

export async function retagAllImages(
  onProgress?: (progress: RetagProgress) => void
): Promise<{ total: number; updated: number }> {
  const allImages = await filedb.toArray();
  const masterTags = await filedb.getMasterTags();
  
  const total = allImages.length;
  let processed = 0;
  let updated = 0;

  onProgress?.({
    total,
    processed,
    status: 'Starting re-tagging...'
  });

  for (const image of allImages) {
    // Generate new tags from filename
    const newTags = matchTagsFromFilename(image.filename, masterTags);
    
    // Only update if tags have changed
    const oldTagsSet = new Set(image.tags);
    const newTagsSet = new Set(newTags);
    const tagsChanged = 
      oldTagsSet.size !== newTagsSet.size ||
      ![...oldTagsSet].every(tag => newTagsSet.has(tag));

    if (tagsChanged) {
      await filedb.update(image.relativePath, { tags: newTags });
      updated++;
    }

    processed++;

    if (processed % 10 === 0 || processed === total) {
      onProgress?.({
        total,
        processed,
        status: `Re-tagged ${processed} / ${total} images (${updated} updated)`
      });
    }

    // Force save every 100 images
    if (processed % 100 === 0) {
      await filedb.forceSave();
    }
  }

  // Final save
  await filedb.forceSave();

  return { total, updated };
}
