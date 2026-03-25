// Emergency script to clear ALL tags from ALL images in database

import { filedb } from './filedb';

export async function clearAllTagsNow(): Promise<number> {
  console.log('CLEARING ALL TAGS FROM DATABASE...');
  
  const allImages = await filedb.toArray();
  let cleared = 0;
  
  for (const image of allImages) {
    if (image.tags && image.tags.length > 0) {
      await filedb.update(image.relativePath, { tags: [] });
      cleared++;
      
      if (cleared % 100 === 0) {
        console.log(`Cleared ${cleared}/${allImages.length} images...`);
        await filedb.forceSave();
      }
    }
  }
  
  await filedb.forceSave();
  console.log(`DONE! Cleared tags from ${cleared} images`);
  
  return cleared;
}
