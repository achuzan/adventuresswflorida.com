import { sanitizeHtml } from '../src/shared/store'
import type { InternalProduct } from './gelato'

export type AiConnection = {
  baseUrl: string
  apiKey: string
  model: string
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

export function defaultAiBaseUrl() {
  return DEFAULT_BASE_URL
}

export function normalizeAiBaseUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (host === 'metadata.google.internal' || host === '169.254.169.254') return null
  let path = url.pathname.replace(/\/+$/, '')
  path = path.replace(/\/chat\/completions$/i, '').replace(/\/models$/i, '')
  return `${url.protocol}//${url.host}${path}`
}

export function normalizeAiModel(input: string) {
  const model = input.trim()
  if (!model) return ''
  if (model.length > 120 || !/^[\w./:-]+$/.test(model)) return null
  return model
}

export function fallbackAiModel(baseUrl: string) {
  if (baseUrl.includes('generativelanguage.googleapis.com')) return 'gemini-2.5-flash'
  if (baseUrl.includes('api.openai.com')) return 'gpt-4o-mini'
  return ''
}

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

function scrub(message: string) {
  return message
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, '[key]')
    .replace(/\bAIza[\w-]{10,}\b/g, '[key]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[key]')
    .slice(0, 240)
}

function hostLabel(baseUrl: string) {
  try {
    return new URL(baseUrl).host
  } catch {
    return 'the AI service'
  }
}

function authHeaders(connection: AiConnection) {
  return { Authorization: `Bearer ${connection.apiKey}` }
}

function modelIds(data: unknown) {
  if (!data || typeof data !== 'object') return []
  const rows = (data as { data?: unknown }).data
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => (row && typeof row === 'object' ? String((row as { id?: unknown }).id ?? '') : ''))
    .map((id) => id.trim())
    .filter(Boolean)
}

function modelListed(ids: string[], model: string) {
  return ids.some((id) => id === model || id.endsWith(`/${model}`))
}

async function readError(res: Response) {
  const data = (await res.json().catch(() => null)) as { error?: { message?: string } | string } | null
  const error = data?.error
  const message = typeof error === 'string' ? error : error?.message
  return scrub(message || `The AI service returned ${res.status}`)
}

export async function testAiConnection(connection: AiConnection) {
  let models: Response
  try {
    models = await fetch(`${connection.baseUrl}/models`, {
      headers: authHeaders(connection),
      signal: AbortSignal.timeout(20000),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach the AI service'
    return { ok: false, detail: scrub(message) }
  }
  if (models.status === 200) {
    const ids = modelIds(await models.json().catch(() => null))
    if (ids.length && !modelListed(ids, connection.model)) {
      return {
        ok: false,
        detail: `The key works, but “${connection.model}” is not in the model list.`,
      }
    }
    return { ok: true, detail: `Connected to ${hostLabel(connection.baseUrl)} using ${connection.model}.` }
  }
  if (models.status !== 404 && models.status !== 405) {
    return { ok: false, detail: await readError(models) }
  }
  return testWithReply(connection)
}

async function testWithReply(connection: AiConnection) {
  try {
    const text = await complete(connection, 'Reply with the word ok.', '', 16, 'Reply briefly.')
    if (!text) return { ok: false, detail: 'The service answered, but did not return any text.' }
    return { ok: true, detail: `Connected to ${hostLabel(connection.baseUrl)} using ${connection.model}.` }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach the AI service'
    return { ok: false, detail: scrub(message) }
  }
}

export async function writeProductDescription(connection: AiConnection, product: InternalProduct) {
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
  const prompt = [
    'Write a product description for the Adventures in Southwest Florida store.',
    'The shop sells wildlife photography by Brad Kemp as prints, calendars, and mugs. Each item is printed to order.',
    'Use only the facts below. Do not invent sizes, paper, page counts, or materials that are not listed.',
    'Write 2 short paragraphs in plain text. No title, markdown, or bullet list.',
    JSON.stringify(facts),
  ].join('\n\n')
  const images = product.images ?? []
  const image = images.find((url) => url.startsWith('https://')) || product.previewUrl || ''
  try {
    const html = toHtml(await complete(connection, prompt, image, 450))
    if (!html) throw new Error('The AI service did not return a description')
    return html
  } catch (error) {
    if (!image) throw error
    const html = toHtml(await complete(connection, prompt, '', 450))
    if (!html) throw error
    return html
  }
}

type ChatMessage = { role: string; content: unknown }

function allowsThinkingSwitch(baseUrl: string) {
  return !baseUrl.includes('api.openai.com') && !baseUrl.includes('generativelanguage.googleapis.com')
}

function chatBody(connection: AiConnection, messages: ChatMessage[], maxTokens: number, direct: boolean) {
  const body: {
    model: string
    temperature: number
    max_tokens: number
    messages: ChatMessage[]
    options?: { think: false }
    reasoning_effort?: 'none'
  } = {
    model: connection.model,
    temperature: 0.4,
    max_tokens: maxTokens,
    messages,
  }
  if (!direct) return body
  if (connection.baseUrl.includes('generativelanguage.googleapis.com')) body.reasoning_effort = 'none'
  else if (allowsThinkingSwitch(connection.baseUrl)) body.options = { think: false }
  return body
}

function rejectedThinkingSwitch(message: string) {
  return /think|options|reasoning_effort|unknown|unexpected|unrecognized|extra/i.test(message)
}

async function complete(connection: AiConnection, text: string, image: string, maxTokens: number, system?: string) {
  const userContent = image.startsWith('https://')
    ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: image } }]
    : text
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        system ||
        'You write accurate catalog copy for a wildlife photography print shop. Sound specific and calm. Never mention Gelato, wholesale cost, or that you are an AI.',
    },
    { role: 'user', content: userContent },
  ]
  let direct = true
  let tokens = maxTokens
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${connection.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        ...authHeaders(connection),
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify(chatBody(connection, messages, tokens, direct)),
    })
    const data = (await res.json().catch(() => null)) as {
      error?: { message?: string } | string
      choices?: { finish_reason?: string; message?: { content?: unknown } }[]
    } | null
    if (!res.ok) {
      const error = data?.error
      const message = typeof error === 'string' ? error : error?.message || ''
      if (attempt === 0 && direct && rejectedThinkingSwitch(message)) {
        direct = false
        continue
      }
      throw new Error(scrub(message || `The AI service returned ${res.status}`))
    }
    const content = visibleAnswer(data?.choices?.[0]?.message?.content)
    if (content) return content
    if (attempt === 0 && data?.choices?.[0]?.finish_reason === 'length') {
      tokens = Math.max(tokens * 2, 1200)
      continue
    }
    throw new Error('The AI service did not return a description')
  }
  throw new Error('The AI service did not return a description')
}

function visibleAnswer(content: unknown) {
  return messageText(content)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (!part || typeof part !== 'object') return ''
      const row = part as { text?: unknown; type?: unknown; thought?: unknown }
      if (row.thought === true) return ''
      const type = typeof row.type === 'string' ? row.type : ''
      if (type === 'reasoning' || type === 'thinking' || type === 'thought') return ''
      return typeof row.text === 'string' ? row.text : ''
    })
    .filter(Boolean)
    .join('\n')
}
