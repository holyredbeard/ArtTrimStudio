// Filename-based tag matching against master tag list

export function matchTagsFromFilename(filename: string, masterTags: string[]): string[] {
  // Remove file extension and convert to lowercase
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').toLowerCase();
  
  // Split filename into words (by common separators)
  const words = nameWithoutExt.split(/[\s_\-.,;:()[\]{}]+/).filter(w => w.length > 0);
  
  const matchedTags: string[] = [];
  
  for (const tag of masterTags) {
    const tagLower = tag.toLowerCase();
    
    // Check if tag matches any word in filename
    for (const word of words) {
      if (word === tagLower || word.includes(tagLower) || tagLower.includes(word)) {
        if (!matchedTags.includes(tag)) {
          matchedTags.push(tag);
        }
        break;
      }
    }
  }
  
  return matchedTags;
}
