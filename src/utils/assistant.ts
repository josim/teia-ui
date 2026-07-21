import Anthropic from '@anthropic-ai/sdk'
import { MAX_EDITIONS, MAX_ROYALTIES, MIN_ROYALTIES } from '@constants'

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-8'
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_OLLAMA_MODEL = 'qwen3:8b'

export interface AssistantSettings {
  provider: 'claude' | 'ollama'
  apiKey: string
  claudeModel: string
  ollamaUrl: string
  ollamaModel: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatAttachment {
  name: string
  mimeType: string
  /** base64 image data, included so the model can see the artwork */
  base64?: string
}

const VISION_MIMETYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export interface AssistantAction {
  action: 'prepare_mint' | 'prepare_swap'
  params: Record<string, any>
}

export interface AssistantReply {
  message: string
  action?: AssistantAction
}

const SYSTEM_PROMPT = `You are the Teia assistant, a minting and sales helper embedded in teia.art — the community-owned NFT platform on Tezos. You help artists prepare mints and list their OBJKTs for sale. Your voice is warm, plain, and brief, like a helpful co-op member.

Rules:
- You only prepare actions; the user always reviews and confirms before anything happens, and every transaction is signed by their own wallet. Never claim you minted or listed something yourself.
- Minting: editions must be 1-${MAX_EDITIONS}, royalties ${MIN_ROYALTIES}-${MAX_ROYALTIES}%.
- Artwork files: on the assistant page the user attaches the file directly in the chat — you will see a note like "[attached file: name (type)]" in their message, and attached images are shown to you. When you can see the artwork, offer to suggest a title, description, and tags. On the small panel there is no attach button; there the mint form is prefilled and the user adds the file on the mint page.
- If the attached artwork is not an image (video, audio, html/zip, pdf), a cover image (jpeg/png/gif) is also required — remind the user to attach one in the chat.
- Text mints (typed art) need no file: the text itself is the artwork, so when the user wants to mint a text piece (a poem, haiku, ascii art), set text_mint and text_content.
- Only set license or language when the user asked for them; both are optional.
- Listing (swap): you need the OBJKT id, the price per edition in tez, and how many editions to list. The user must own the editions.
- Use a tool only when the user clearly wants the action and you have the required values; ask for missing values instead of guessing. Everything else is a normal short reply.
- If asked about anything unrelated to minting, listing, or Teia basics, say it's outside what you can help with here.`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'prepare_mint',
    description:
      'Prefill the Teia mint form with the given values. The user will attach the artwork file, review, and confirm on the mint page. Use when the user wants to mint and has provided at least editions and royalties.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Max 500 characters' },
        description: { type: 'string', description: 'Max 5000 characters' },
        tags: {
          type: 'string',
          description: 'Comma separated, e.g. "illustration, digital"',
        },
        editions: {
          type: 'integer',
          description: `Number of editions, 1-${MAX_EDITIONS}`,
        },
        royalties: {
          type: 'integer',
          description: `Royalties percent, ${MIN_ROYALTIES}-${MAX_ROYALTIES}`,
        },
        nsfw: { type: 'boolean' },
        photosensitive: {
          type: 'boolean',
          description: 'Photo-sensitive seizure warning',
        },
        license: {
          type: 'string',
          enum: [
            'none',
            'cc-by-4.0',
            'cc-by-sa-4.0',
            'cc-by-nd-4.0',
            'cc-by-nc-4.0',
            'cc-by-nc-sa-4.0',
            'cc-by-nc-nd-4.0',
          ],
          description:
            'Optional license. "none" means all rights reserved; the cc-* values are Creative Commons licenses.',
        },
        language: {
          type: 'string',
          description:
            'Optional ISO 639 language code of the work, e.g. "en", "de", "ja"',
        },
        text_mint: {
          type: 'boolean',
          description:
            'True when this is a typed-art text mint: the text itself is the artwork and no file is needed',
        },
        text_content: {
          type: 'string',
          description: 'The full text of the typed-art piece, for text mints',
        },
        monospace: {
          type: 'boolean',
          description: 'Render the typed-art text in a monospace font',
        },
      },
      required: ['editions', 'royalties'],
    },
  },
  {
    name: 'prepare_swap',
    description:
      'Prepare a listing (swap) of editions the user owns on the Teia marketplace. The user reviews and confirms, then signs with their wallet.',
    input_schema: {
      type: 'object',
      properties: {
        objkt_id: { type: 'string', description: 'The OBJKT (token) id' },
        price: {
          type: 'number',
          description: 'Price per edition in tez, greater than 0',
        },
        amount: {
          type: 'integer',
          description: 'Number of editions to list, at least 1',
        },
      },
      required: ['objkt_id', 'price', 'amount'],
    },
  },
]

const buildClient = (settings: AssistantSettings) => {
  if (settings.provider === 'ollama') {
    return new Anthropic({
      apiKey: 'ollama',
      baseURL: settings.ollamaUrl || DEFAULT_OLLAMA_URL,
      dangerouslyAllowBrowser: true,
    })
  }
  return new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
  })
}

const modelFor = (settings: AssistantSettings) =>
  settings.provider === 'ollama'
    ? settings.ollamaModel || DEFAULT_OLLAMA_MODEL
    : settings.claudeModel || DEFAULT_CLAUDE_MODEL

/**
 * Send the conversation and return the assistant reply and, when the model
 * proposes one, a pending action for the user to confirm.
 */
export async function sendChat(
  settings: AssistantSettings,
  messages: ChatMessage[],
  attachment?: ChatAttachment
): Promise<AssistantReply> {
  const client = buildClient(settings)

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))
  // show the attached image to the model on the turn it was attached
  if (
    attachment?.base64 &&
    VISION_MIMETYPES.includes(attachment.mimeType) &&
    apiMessages.length > 0
  ) {
    const last = apiMessages[apiMessages.length - 1]
    if (last.role === 'user') {
      last.content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: attachment.mimeType as any,
            data: attachment.base64,
          },
        },
        { type: 'text', text: String(last.content) },
      ]
    }
  }

  const response = await client.messages.create({
    model: modelFor(settings),
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: apiMessages,
  })

  let message = ''
  let action: AssistantAction | undefined
  for (const block of response.content) {
    if (block.type === 'text') {
      message += block.text
    } else if (
      block.type === 'tool_use' &&
      (block.name === 'prepare_mint' || block.name === 'prepare_swap')
    ) {
      action = {
        action: block.name,
        params: block.input as Record<string, any>,
      }
    }
  }
  return { message: message.trim(), action }
}

/** Cheap connectivity check used by the settings view. */
export async function testConnection(
  settings: AssistantSettings
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendChat(settings, [{ role: 'user', content: 'Say "ok".' }])
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}
