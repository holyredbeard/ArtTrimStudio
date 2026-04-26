// Filename-based tag matching against master tag list
import { matchesTagOrSynonym, getMergedSynonyms } from './tagsynonyms';

export function matchTagsFromFilename(filename: string, masterTags: string[]): string[] {
  // Remove file extension and convert to lowercase
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').toLowerCase();
  
  // Split filename into words (by common separators)
  const words = nameWithoutExt.split(/[\s_\-.,;:()[\]{}]+/).filter(w => w.length > 0);
  
  const matchedTags: string[] = [];
  const synonyms = getMergedSynonyms();
  
  for (const tag of masterTags) {
    // Check if tag or any of its synonyms match any word in filename
    for (const word of words) {
      if (matchesTagOrSynonym(word, tag, synonyms)) {
        if (!matchedTags.includes(tag)) {
          matchedTags.push(tag);
        }
        break;
      }
    }
  }
  
  return matchedTags;
}
