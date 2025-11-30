/**
 * Cleans song names by removing unwanted prefixes/suffixes
 */
export function cleanSongName(name: string): string {
  let cleaned = name
  
  // Remove [SPOTDOWNLOADER.COM] and variations
  cleaned = cleaned.replace(/\[SPOTDOWNLOADER\.COM\]/gi, '')
  cleaned = cleaned.replace(/\[SPOTDOWNLOADER\]/gi, '')
  cleaned = cleaned.replace(/SPOTDOWNLOADER\.COM/gi, '')
  cleaned = cleaned.replace(/SPOTDOWNLOADER/gi, '')
  
  // Remove other common unwanted prefixes
  cleaned = cleaned.replace(/^\[.*?\]\s*/g, '') // Remove [anything] at start
  cleaned = cleaned.replace(/\s*\[.*?\]$/g, '') // Remove [anything] at end
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned || name // Return original if cleaned is empty
}

