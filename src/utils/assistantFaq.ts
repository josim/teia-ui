import { FAQ_CHUNKS } from '@data/faqContent'

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)

/** Keyword search over the bundled FAQ/docs chunks (no embeddings needed at this size). */
export function searchFaq(input: { query?: string }, topK = 5): string {
  const terms = tokenize(String(input?.query || ''))
  if (!terms.length) throw new Error('Empty search query')

  // document frequency per term for a BM25-ish weighting
  const df: Record<string, number> = {}
  const chunkTokens = FAQ_CHUNKS.map((c) => tokenize(`${c.topic} ${c.text}`))
  for (const term of terms) {
    df[term] = chunkTokens.filter((toks) => toks.includes(term)).length || 0
  }

  const scored = FAQ_CHUNKS.map((chunk, i) => {
    const toks = chunkTokens[i]
    let score = 0
    for (const term of terms) {
      const tf = toks.filter((t) => t === term).length
      if (!tf) continue
      const idf = Math.log(1 + FAQ_CHUNKS.length / (1 + (df[term] || 0)))
      score += idf * (tf / (tf + 1.5))
      // topic hits weigh extra
      if (tokenize(chunk.topic).includes(term)) score += idf
    }
    return { chunk, score }
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  if (!scored.length)
    return 'No matching FAQ entries found. Tell the user you could not find this in the Teia docs and suggest asking in the community Discord or checking https://teia.art/faq.'

  return scored
    .map(({ chunk }) => `[${chunk.topic}]\n${chunk.text}`)
    .join('\n\n---\n\n')
}
