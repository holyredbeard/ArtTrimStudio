// Tag synonym system for advanced tag matching
// Maps master tags to their synonyms and related words

export interface TagSynonyms {
  [masterTag: string]: string[];
}

// Default synonym mappings
export const defaultSynonyms: TagSynonyms = {
  'folklore': ['fairytale', 'fairy tale', 'myth', 'legend', 'fable', 'tale', 'story', 'folk'],
  'landscape': ['scenery', 'vista', 'view', 'nature', 'outdoor', 'terrain', 'panorama'],
  'portrait': ['face', 'person', 'people', 'headshot', 'selfie', 'character'],
  'abstract': ['modern', 'contemporary', 'geometric', 'pattern', 'shapes'],
  'fantasy': ['magic', 'magical', 'mystical', 'enchanted', 'dragon', 'wizard', 'elf'],
  'nature': ['natural', 'wilderness', 'wild', 'forest', 'mountain', 'ocean', 'river'],
  'urban': ['city', 'street', 'building', 'architecture', 'downtown', 'metropolitan'],
  'vintage': ['retro', 'old', 'antique', 'classic', 'nostalgic', 'aged'],
  'minimalist': ['minimal', 'simple', 'clean', 'basic', 'plain'],
  'colorful': ['vibrant', 'bright', 'vivid', 'rainbow', 'multicolor', 'chromatic'],
  'dark': ['black', 'noir', 'shadow', 'moody', 'gothic', 'grim'],
  'light': ['bright', 'luminous', 'radiant', 'glowing', 'sunny'],
  'winter': ['snow', 'ice', 'cold', 'frost', 'frozen', 'snowy'],
  'summer': ['sun', 'sunny', 'warm', 'beach', 'tropical'],
  'autumn': ['fall', 'leaves', 'harvest', 'orange', 'foliage'],
  'spring': ['bloom', 'blossom', 'flower', 'fresh', 'green'],
  'water': ['ocean', 'sea', 'lake', 'river', 'stream', 'aqua', 'blue'],
  'fire': ['flame', 'burning', 'blaze', 'inferno', 'ember'],
  'spiritual': ['sacred', 'holy', 'divine', 'religious', 'zen', 'meditation'],
  'animal': ['creature', 'beast', 'wildlife', 'fauna', 'pet'],
  'digital': ['cyber', 'tech', 'electronic', 'virtual', 'computer'],
  'traditional': ['classic', 'conventional', 'heritage', 'cultural'],
  'modern': ['contemporary', 'current', 'new', 'recent', 'latest'],
  'artistic': ['art', 'creative', 'artistic', 'painting', 'drawing'],
  'photographic': ['photo', 'photograph', 'camera', 'shot', 'image'],
};

/**
 * Get synonyms for a master tag
 */
export function getSynonymsForTag(masterTag: string, customSynonyms?: TagSynonyms): string[] {
  const synonyms = customSynonyms || defaultSynonyms;
  return synonyms[masterTag.toLowerCase()] || [];
}

/**
 * Get all variations of a tag (including the tag itself and its synonyms)
 */
export function getTagVariations(masterTag: string, customSynonyms?: TagSynonyms): string[] {
  const synonyms = getSynonymsForTag(masterTag, customSynonyms);
  return [masterTag.toLowerCase(), ...synonyms];
}

/**
 * Check if a word matches a master tag or any of its synonyms
 */
export function matchesTagOrSynonym(
  word: string,
  masterTag: string,
  customSynonyms?: TagSynonyms
): boolean {
  const wordLower = word.toLowerCase();
  const variations = getTagVariations(masterTag, customSynonyms);
  
  // Check exact match
  if (variations.includes(wordLower)) {
    return true;
  }
  
  // Check partial match (word contains variation or variation contains word)
  for (const variation of variations) {
    if (wordLower.includes(variation) || variation.includes(wordLower)) {
      // Avoid false positives with very short words
      if (variation.length >= 3 && wordLower.length >= 3) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Add custom synonyms to a tag
 */
export function addSynonyms(
  masterTag: string,
  synonyms: string[],
  existingSynonyms: TagSynonyms = {}
): TagSynonyms {
  const updated = { ...existingSynonyms };
  const tagLower = masterTag.toLowerCase();
  
  if (!updated[tagLower]) {
    updated[tagLower] = [];
  }
  
  // Add new synonyms, avoiding duplicates
  for (const synonym of synonyms) {
    const synonymLower = synonym.toLowerCase();
    if (!updated[tagLower].includes(synonymLower)) {
      updated[tagLower].push(synonymLower);
    }
  }
  
  return updated;
}

/**
 * Load custom synonyms from storage
 */
export function loadCustomSynonyms(): TagSynonyms {
  try {
    const stored = localStorage.getItem('customTagSynonyms');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load custom synonyms:', error);
  }
  return {};
}

/**
 * Save custom synonyms to storage
 */
export function saveCustomSynonyms(synonyms: TagSynonyms): void {
  try {
    localStorage.setItem('customTagSynonyms', JSON.stringify(synonyms));
  } catch (error) {
    console.error('Failed to save custom synonyms:', error);
  }
}

/**
 * Merge default and custom synonyms
 */
export function getMergedSynonyms(): TagSynonyms {
  const custom = loadCustomSynonyms();
  const merged = { ...defaultSynonyms };
  
  // Merge custom synonyms with defaults
  for (const [tag, synonyms] of Object.entries(custom)) {
    if (merged[tag]) {
      merged[tag] = [...new Set([...merged[tag], ...synonyms])];
    } else {
      merged[tag] = synonyms;
    }
  }
  
  return merged;
}
