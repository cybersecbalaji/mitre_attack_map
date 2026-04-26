import { ATTACKTechnique } from "@/types"

const STOPWORDS = new Set([
  "detect", "detection", "rule", "alert", "monitor", "monitoring",
  "via", "from", "with", "the", "and", "for", "use", "using",
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_/.,;:()[\]{}'"!?]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
}

export interface FuzzyMatchResult {
  technique: ATTACKTechnique
  score: number
}

/**
 * Find the best matching technique for a rule name using keyword overlap.
 * Returns null if no match exceeds the threshold (0.4 by default).
 */
export function fuzzyMatchTechnique(
  ruleName: string,
  techniques: ATTACKTechnique[],
  threshold = 0.4
): ATTACKTechnique | null {
  const ruleWords = tokenize(ruleName)
  if (ruleWords.length === 0) return null

  let bestScore = 0
  let bestMatch: ATTACKTechnique | null = null

  for (const technique of techniques) {
    const techniqueWords = tokenize(technique.name)
    if (techniqueWords.length === 0) continue

    const overlap = ruleWords.filter((w) => techniqueWords.includes(w)).length
    const score = overlap / Math.max(ruleWords.length, techniqueWords.length)

    if (score > threshold && score > bestScore) {
      bestScore = score
      bestMatch = technique
    }
  }

  return bestMatch
}

/** Return all matches above threshold, sorted by score descending */
export function fuzzyMatchAll(
  ruleName: string,
  techniques: ATTACKTechnique[],
  threshold = 0.4,
  limit = 5
): FuzzyMatchResult[] {
  const ruleWords = tokenize(ruleName)
  if (ruleWords.length === 0) return []

  const results: FuzzyMatchResult[] = []
  for (const technique of techniques) {
    const techniqueWords = tokenize(technique.name)
    if (techniqueWords.length === 0) continue

    const overlap = ruleWords.filter((w) => techniqueWords.includes(w)).length
    const score = overlap / Math.max(ruleWords.length, techniqueWords.length)

    if (score > threshold) {
      results.push({ technique, score })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
