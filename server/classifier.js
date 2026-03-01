import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are a bookmark classifier. Given tweet content, return a JSON object with:
- "category": exactly one of ["Design", "Dev", "Tools", "Threads", "Reads", "Uncategorized"]
- "tags": array of 2-5 lowercase kebab-case tags relevant to the content

Respond with ONLY valid JSON. No explanation, no markdown, no code fences.

Examples:
{"category": "Dev", "tags": ["react", "performance", "hooks"]}
{"category": "Design", "tags": ["figma", "ui-components", "design-systems"]}`

export async function classifyBookmark(text, authorHandle) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { category: 'Uncategorized', tags: [] }
  }

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Author: @${authorHandle}\n\n${text.slice(0, 500)}`
      }]
    })

    const raw = msg.content[0].text.trim()
    const parsed = JSON.parse(raw)

    const validCategories = ['Design', 'Dev', 'Tools', 'Threads', 'Reads', 'Uncategorized']
    return {
      category: validCategories.includes(parsed.category) ? parsed.category : 'Uncategorized',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(t => String(t).toLowerCase()) : []
    }
  } catch {
    return { category: 'Uncategorized', tags: [] }
  }
}

// Classify a batch with a small delay between each to avoid rate limits.
// Returns array of { id, category, tags }.
export async function classifyBatch(bookmarks) {
  const results = []
  for (const bm of bookmarks) {
    const classification = await classifyBookmark(bm.text, bm.author?.handle || 'unknown')
    results.push({ id: bm.id, ...classification })
    // Small delay to avoid hammering the API on large batches
    await new Promise(r => setTimeout(r, 150))
  }
  return results
}
