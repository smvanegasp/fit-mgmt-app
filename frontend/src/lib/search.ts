// Small typo-tolerant matcher: no dependency, tuned for short names (exercises, aliases).

/** Lowercase and strip accents so "Café" matches "cafe". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function words(text: string): string[] {
  return normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Optimal string alignment distance (Levenshtein plus adjacent swaps, so "rcie" ≈ "rice"). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Typos allowed for a query word: none for 1–2 letters, 1 up to 5 letters, 2 beyond. */
function allowedTypos(length: number): number {
  if (length <= 2) return 0;
  return length <= 5 ? 1 : 2;
}

function wordMatches(queryWord: string, word: string): boolean {
  if (word.startsWith(queryWord)) return true;
  const typos = allowedTypos(queryWord.length);
  if (typos === 0) return false;
  if (editDistance(queryWord, word) <= typos) return true;
  // Half-typed and misspelled ("tomta" → "tomatoes"): allow one typo against the
  // word's prefixes. Only for 4+ letters, or short queries match too much.
  if (queryWord.length < 4) return false;
  return [-1, 0, 1].some(
    (delta) => editDistance(queryWord, word.slice(0, queryWord.length + delta)) <= 1,
  );
}

/** Same word, give or take a typo or a plural ("bean" / "beans"); no prefixes. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const typos = allowedTypos(Math.min(a.length, b.length));
  return typos > 0 && editDistance(a, b) <= typos;
}

/**
 * Names that may be the same product: every word of the shorter name is a word of the longer
 * one ("Black beans" and "Kirkland black beans"). Also true for "Milk" and "Almond milk", so
 * callers ask the person instead of merging. Whole words only, so half-typed names don't match.
 */
export function similarNames(a: string, b: string): boolean {
  const [short, long] = [words(a), words(b)].sort((x, y) => x.length - y.length);
  if (short.length === 0) return false;
  return short.every((s) => long.some((l) => sameWord(s, l)));
}

/** True when every word of the query matches some word of the text (in any order). */
export function fuzzyMatch(query: string, ...texts: string[]): boolean {
  const queryWords = words(query);
  if (queryWords.length === 0) return true;
  const target = texts.flatMap(words);
  if (normalize(texts.join(" ")).includes(normalize(query.trim()))) return true;
  return queryWords.every((q) => target.some((w) => wordMatches(q, w)));
}
