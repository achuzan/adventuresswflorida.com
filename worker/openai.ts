import { sanitizeHtml } from '../src/shared/store'
import type { InternalProduct } from './gelato'

function plain(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toHtml(text: string) {
  const clean = text.replace(/<[^>]+>/g, '').trim()
  const blocks = clean
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, 6)
  const html = blocks
    .map((block) => `<p>${block.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('')
  return sanitizeHtml(html).slice(0, 4000)
}

export async function testOpenAiKey(key: string) {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (res.status === 200) return { ok: true, detail: 'OpenAI accepted the API key.' }
  const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  const message = data?.error?.message || `OpenAI returned ${res.status}`
  return { ok: false, detail: message.replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, '[key]').slice(0, 240) }
}

export async function writeProductDescription(key: string, product: InternalProduct) {
  const facts = {
    title: product.title,
    type: product.productType || 'print',
    gelatoDescription: plain(product.description).slice(0, 1200),
    options: product.options,
    variants: product.variants.slice(0, 12).map((variant) => ({
      title: variant.title,
      options: variant.options,
    })),
  }
  const images = product.images ?? []
  const image = images.find((url) => url.startsWith('https://')) || product.previewUrl || ''
  try {
    return await askOpenAi(key, facts, image)
  } catch (error) {
    if (!image) throw error
    return await askOpenAi(key, facts, '')
  }
}

async function askOpenAi(key: string, facts: unknown, image: string) {
  const text = [
    'Write a product description for the Adventures in Southwest Florida store.',
    'The shop sells wildlife photography by Brad Kemp as prints, calendars, and mugs. Each item is printed to order.',
    'Use only the facts below. Do not invent sizes, paper, page counts, or materials that are not listed.',
    'Write 2 short paragraphs in plain text. No title, markdown, or bullet list.',
    JSON.stringify(facts),
  ].join('\n\n')
  const userContent: unknown[] = [{ type: 'text', text }]
  if (image && image.startsWith('https://')) {
    userContent.push({ type: 'image_url', image_url: { url: image } })
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 450,
      messages: [
        {
          role: 'system',
          content:
            'You write accurate catalog copy for a wildlife photography print shop. Sound specific and calm. Never mention Gelato, wholesale cost, or that you are an AI.',
        },
        { role: 'user', content: userContent },
      ],
    }),
  })
  const data = (await res.json().catch(() => null)) as {
    error?: { message?: string }
    choices?: { message?: { content?: string } }[]
  } | null
  if (!res.ok) {
    const message = data?.error?.message || `OpenAI returned ${res.status}`
    throw new Error(message.replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, '[key]').slice(0, 240))
  }
  const content = data?.choices?.[0]?.message?.content?.trim() || ''
  const html = toHtml(content)
  if (!html) throw new Error('OpenAI did not return a description')
  return html
}
