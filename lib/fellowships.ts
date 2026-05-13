export const FELLOWSHIPS = [
  'All Grace',
  'Exousia',
  'Special Dunamis',
  'Katalambano',
  'Pleroma',
  'Young and Ready',
  'HSM',
  'Menorah',
  'Enthroned',
  'Mega',
  'Professionals'
];

function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function matchFellowship(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return 'Unassigned';
  
  const cleanInput = input.trim().toLowerCase();
  if (cleanInput === '' || cleanInput === 'unassigned' || cleanInput === 'none' || cleanInput === 'n/a') {
    return 'Unassigned';
  }

  let bestMatch = 'Unassigned';
  let bestScore = 0;

  for (const fellowship of FELLOWSHIPS) {
    const cleanFellowship = fellowship.toLowerCase();
    
    // Exact match is an immediate return
    if (cleanFellowship === cleanInput) return fellowship;

    // Substring match logic: if one contains the other and it's a significant portion
    if (cleanInput.includes(cleanFellowship) || cleanFellowship.includes(cleanInput)) {
       const minLen = Math.min(cleanInput.length, cleanFellowship.length);
       // Avoid matching tiny 1-2 letter acronyms purely by substring unless it's a very good match
       if (minLen >= 3) {
          // Boost score artificially to prefer substring matches heavily
          const score = 0.8 + (minLen / Math.max(cleanInput.length, cleanFellowship.length)) * 0.2;
          if (score > bestScore) {
             bestScore = score;
             bestMatch = fellowship;
          }
          continue;
       }
    }

    const distance = levenshteinDistance(cleanInput, cleanFellowship);
    const maxLen = Math.max(cleanInput.length, cleanFellowship.length);
    const similarity = 1 - distance / maxLen;

    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = fellowship;
    }
  }

  // Threshold: If it's less than 40% similar, assume it's a far cry and fallback to Unassigned
  if (bestScore < 0.4) {
    return 'Unassigned';
  }

  return bestMatch;
}
