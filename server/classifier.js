import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(categories) {
  // categories: [{ name, children[] }]
  const lines = categories.flatMap(cat =>
    cat.children.length > 0
      ? [`- "${cat.name}" with subcategories: ${cat.children.map(c => `"${c}"`).join(', ')}`]
      : [`- "${cat.name}"`]
  )
  return `You are a bookmark classifier. Given tweet content, classify it into the user's category system.

Categories:
${lines.join('\n')}

Return a JSON object with:
- "category": exactly one top-level category name from the list above
- "subcategory": the most specific subcategory name if one fits, otherwise null
- "tags": array of 2-5 lowercase kebab-case tags relevant to the content

Respond with ONLY valid JSON. No explanation, no markdown, no code fences.

Examples:
{"category": "Dev", "subcategory": "Frontend", "tags": ["react", "performance"]}
{"category": "Design", "subcategory": null, "tags": ["figma", "ui-systems"]}`
}

export async function classifyBookmark(text, authorHandle, categories = []) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { category: 'Uncategorized', subcategory: null, tags: [] }
  }

  const validTopLevel = categories.map(c => c.name)
  const validSubs = Object.fromEntries(categories.map(c => [c.name, c.children]))

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: buildSystemPrompt(categories),
      messages: [{ role: 'user', content: `Author: @${authorHandle}\n\n${text.slice(0, 500)}` }],
    })

    const parsed = JSON.parse(msg.content[0].text.trim())
    const category = validTopLevel.includes(parsed.category) ? parsed.category : 'Uncategorized'
    const validSubList = validSubs[category] || []
    const subcategory = validSubList.includes(parsed.subcategory) ? parsed.subcategory : null

    return {
      category,
      subcategory,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(t => String(t).toLowerCase()) : [],
    }
  } catch {
    return { category: 'Uncategorized', subcategory: null, tags: [] }
  }
}

export async function classifyBatch(bookmarks, categories = []) {
  const results = []
  for (const bm of bookmarks) {
    const classification = await classifyBookmark(bm.text, bm.author?.handle || 'unknown', categories)
    results.push({ id: bm.id, ...classification })
    await new Promise(r => setTimeout(r, 150))
  }
  return results
}
