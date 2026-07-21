import Anthropic from '@anthropic-ai/sdk'
import { MAX_EDITIONS, MAX_ROYALTIES, MIN_ROYALTIES } from '@constants'
import {
  getSchemaSlice,
  runTeztokQuery,
  MAX_QUERY_LIMIT,
  TEZTOK_TABLE_INDEX,
} from '@utils/assistantData'
import { getHoldings, getListings } from '@utils/assistantSale'
import { searchFaq } from '@utils/assistantFaq'
import { TEZTOK_SCHEMA_DOC } from '@data/teztokSchemaDoc'
import { useUserStore } from '@context/userStore'

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-8'
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_OLLAMA_MODEL = 'qwen3:8b'

export type AssistantMode = 'mint' | 'sale' | 'faq' | 'data'

export const ASSISTANT_MODES: { id: AssistantMode; label: string }[] = [
  { id: 'mint', label: 'mint' },
  { id: 'sale', label: 'sale' },
  { id: 'faq', label: 'faq' },
  { id: 'data', label: 'data' },
]

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
  action: 'prepare_mint' | 'prepare_swap' | 'prepare_cancel' | 'prepare_reswap'
  params: Record<string, any>
}

export interface AssistantReply {
  message: string
  action?: AssistantAction
  /** One-line notes about read tools that ran during the turn */
  trace: string[]
}

const PREAMBLE = `You are the Teia assistant, embedded in teia.art — the community-owned NFT platform on Tezos. Your voice is warm, plain, and brief, like a helpful co-op member. You only prepare actions; the user always reviews and confirms before anything happens, and every transaction is signed by their own wallet. Never claim you executed something yourself.`

/* ---------------- tool schemas ---------------- */

const MINT_TOOL: Anthropic.Tool = {
  name: 'prepare_mint',
  description:
    'Prefill or fully prepare a Teia mint with the given values. The user reviews and confirms. Use when the user wants to mint and has provided at least editions and royalties.',
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
}

const SWAP_TOOL: Anthropic.Tool = {
  name: 'prepare_swap',
  description:
    'Prepare a new listing (swap) of editions the user owns on the Teia marketplace.',
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
}

const CANCEL_TOOL: Anthropic.Tool = {
  name: 'prepare_cancel',
  description:
    "Prepare cancelling one of the user's active listings (delist). Get swap_id and contract_address from get_listings first.",
  input_schema: {
    type: 'object',
    properties: {
      objkt_id: { type: 'string', description: 'The OBJKT id, for display' },
      swap_id: { type: 'string', description: 'From get_listings' },
      contract_address: { type: 'string', description: 'From get_listings' },
    },
    required: ['objkt_id', 'swap_id', 'contract_address'],
  },
}

const RESWAP_TOOL: Anthropic.Tool = {
  name: 'prepare_reswap',
  description:
    "Prepare a price change for one of the user's active Teia listings (cancels and relists in one operation). Get swap_id from get_listings first. Only works for TEIA/HEN swaps, not external marketplaces.",
  input_schema: {
    type: 'object',
    properties: {
      objkt_id: { type: 'string' },
      swap_id: { type: 'string', description: 'From get_listings' },
      new_price: {
        type: 'number',
        description: 'New price per edition in tez, greater than 0',
      },
    },
    required: ['objkt_id', 'swap_id', 'new_price'],
  },
}

const HOLDINGS_TOOL: Anthropic.Tool = {
  name: 'get_holdings',
  description:
    "Look up the editions the user's synced wallet currently owns. No parameters.",
  input_schema: { type: 'object', properties: {} },
}

const LISTINGS_TOOL: Anthropic.Tool = {
  name: 'get_listings',
  description:
    "Look up the user's currently active marketplace listings (price, editions left, swap id). No parameters.",
  input_schema: { type: 'object', properties: {} },
}

const FAQ_TOOL: Anthropic.Tool = {
  name: 'search_faq',
  description:
    'Search the bundled Teia FAQ and documentation. Call this before answering any question about how Teia works.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Keywords to search for' },
    },
    required: ['query'],
  },
}

const QUERY_TOOL: Anthropic.Tool = {
  name: 'query_teztok',
  description: `Run a read-only GraphQL query against the TezTok indexer for Teia/Tezos NFT data. The root field MUST include limit: N with N <= ${MAX_QUERY_LIMIT}. The user sees the full result as a table they can export; you only see the first rows.`,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The GraphQL query document' },
    },
    required: ['query'],
  },
}

const SCHEMA_TOOL: Anthropic.Tool = {
  name: 'get_schema',
  description:
    'Get the columns, relationships and usage notes for one TezTok table before writing a query against it.',
  input_schema: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: `One of: ${TEZTOK_TABLE_INDEX}`,
      },
    },
    required: ['table'],
  },
}

/* ---------------- mode registry ---------------- */

type ReadHandler = (input: Record<string, any>) => Promise<string> | string

interface ModeConfig {
  systemPrompt: (local: boolean) => string
  tools: (local: boolean) => Anthropic.Tool[]
  readHandlers: Record<string, ReadHandler>
  writeTools: string[]
  maxIter: { claude: number; local: number }
}

const MODES: Record<AssistantMode, ModeConfig> = {
  mint: {
    systemPrompt: () => `${PREAMBLE}

You help artists prepare mints.
- Editions must be 1-${MAX_EDITIONS}, royalties ${MIN_ROYALTIES}-${MAX_ROYALTIES}%.
- Artwork files: on the assistant page the user attaches the file directly in the chat — you will see a note like "[attached file: name (type)]", and attached images are shown to you. When you can see the artwork, offer to suggest a title, description, and tags. On the small panel there is no attach button; there the mint form is prefilled and the user adds the file on the mint page.
- If the attached artwork is not an image (video, audio, html/zip, pdf), a cover image (jpeg/png/gif) is also required — remind the user to attach one.
- Text mints (typed art) need no file: when the user wants to mint a text piece (poem, haiku, ascii art), set text_mint and text_content.
- Only set license or language when the user asked for them.
- Use the tool only when the user clearly wants to mint and you have editions and royalties; ask for missing values instead of guessing.`,
    tools: () => [MINT_TOOL],
    readHandlers: {},
    writeTools: ['prepare_mint'],
    maxIter: { claude: 2, local: 1 },
  },
  sale: {
    systemPrompt: () => `${PREAMBLE}

You help the user manage sales of their OBJKTs on the Teia marketplace.
- Use get_holdings to see what they own and get_listings to see what is currently for sale before proposing anything.
- prepare_swap lists editions for sale (needs objkt id, price in tez, amount).
- prepare_cancel delists (needs swap_id + contract_address from get_listings).
- prepare_reswap changes the price of an active listing (needs swap_id + new price).
- Prices are in tez. Never invent swap ids — always read them with get_listings first.
- Ask for missing values instead of guessing.`,
    tools: () => [
      HOLDINGS_TOOL,
      LISTINGS_TOOL,
      SWAP_TOOL,
      CANCEL_TOOL,
      RESWAP_TOOL,
    ],
    readHandlers: {
      get_holdings: () => getHoldings(),
      get_listings: () => getListings(),
    },
    writeTools: ['prepare_swap', 'prepare_cancel', 'prepare_reswap'],
    maxIter: { claude: 4, local: 2 },
  },
  faq: {
    systemPrompt: () => `${PREAMBLE}

You answer questions about how Teia works (minting, collecting, fees, royalties, copyright, the DAO, code of conduct).
- Always call search_faq first and answer ONLY from what it returns — do not answer Teia questions from memory.
- If nothing relevant comes back, say you could not find it and point to https://teia.art/faq and the community Discord.
- Keep answers short and quote the relevant bits.`,
    tools: () => [FAQ_TOOL],
    readHandlers: {
      search_faq: (input) => searchFaq(input),
    },
    writeTools: [],
    maxIter: { claude: 3, local: 2 },
  },
  data: {
    systemPrompt: (local) => {
      const { address } = useUserStore.getState()
      return `${PREAMBLE}

You help the user get data about Teia/Tezos NFTs by writing GraphQL queries against the TezTok indexer, then running them with query_teztok.
- Every query's root field MUST have limit: N with N <= ${MAX_QUERY_LIMIT} (default to 100).
- Only read queries. The full result is shown to the user as a table with CSV/JSON export; you see only the first rows, so summarize and point them to the table.
- If a query errors, fix it and retry once.
- Addresses look like tz1.../KT1...; the Teia FA2 contract is KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton.
- Today's date is ${new Date()
        .toISOString()
        .slice(0, 10)} (use it for relative ranges like "last month").
- ${
        address
          ? `The user's synced wallet address is ${address} — use it when they say "my"/"me". As an artist their tokens have artist_address = that address; sales of their work are events with implements = "SALE" and seller_address = that address.`
          : `No wallet is synced. If the user says "my", ask for their tz... address instead of guessing.`
      }
${
  local
    ? `- Tables available: ${TEZTOK_TABLE_INDEX}. Call get_schema(table) before writing a query against a table you have not seen this conversation.`
    : `Schema reference:\n${TEZTOK_SCHEMA_DOC}`
}`
    },
    tools: (local) => (local ? [QUERY_TOOL, SCHEMA_TOOL] : [QUERY_TOOL]),
    readHandlers: {
      query_teztok: (input) => runTeztokQuery(input),
      get_schema: (input) => getSchemaSlice(String(input?.table || '')),
    },
    writeTools: [],
    maxIter: { claude: 3, local: 2 },
  },
}

/* ---------------- client + loop ---------------- */

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

/** Cap a tool result before it is fed back to the model; the full result
 *  stays client-side (e.g. the data table). */
const truncateForModel = (s: string, local: boolean) => {
  const cap = local ? 2000 : 8000
  return s.length > cap
    ? `${s.slice(0, cap)}… (truncated — the user can see the full result)`
    : s
}

/**
 * Run one assistant turn: an agentic loop where read-only tools execute
 * client-side automatically and results are fed back, while write tools
 * stop the loop and become a pendingAction for human confirmation.
 */
export async function sendChat(
  settings: AssistantSettings,
  mode: AssistantMode,
  messages: ChatMessage[],
  attachment?: ChatAttachment
): Promise<AssistantReply> {
  const client = buildClient(settings)
  const local = settings.provider === 'ollama'
  const cfg = MODES[mode]
  const trace: string[] = []

  const histCap = local ? 6 : 30
  const apiMessages: Anthropic.MessageParam[] = messages
    .slice(-histCap)
    .map((m) => ({ role: m.role, content: m.content }))

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

  const maxIter = local ? cfg.maxIter.local : cfg.maxIter.claude
  let finalText = ''

  for (let i = 0; i <= maxIter; i++) {
    const response = await client.messages.create({
      model: modelFor(settings),
      max_tokens: local ? 768 : 1024,
      system: cfg.systemPrompt(local),
      tools: cfg.tools(local),
      messages: apiMessages,
    })

    let text = ''
    const toolUses: Anthropic.ToolUseBlock[] = []
    for (const block of response.content) {
      if (block.type === 'text') text += block.text
      else if (block.type === 'tool_use') toolUses.push(block)
    }
    if (text.trim()) finalText = text.trim()

    if (toolUses.length === 0) return { message: finalText, trace }

    const writeUse = toolUses.find((t) => cfg.writeTools.includes(t.name))
    if (writeUse) {
      return {
        message: finalText || 'Here is what I prepared — please review.',
        action: {
          action: writeUse.name as AssistantAction['action'],
          params: writeUse.input as Record<string, any>,
        },
        trace,
      }
    }

    if (i === maxIter) break

    // execute read tools client-side and feed results back
    apiMessages.push({ role: 'assistant', content: response.content })
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      const handler = cfg.readHandlers[tu.name]
      let content: string
      let isError = false
      try {
        content = handler
          ? await handler((tu.input as Record<string, any>) ?? {})
          : `Unknown tool: ${tu.name}`
        console.debug('[assistant]', tu.name, {
          input: tu.input,
          resultChars: content.length,
        })
      } catch (e: any) {
        isError = true
        content = String(e?.message || e).slice(0, 200)
        console.warn('[assistant]', tu.name, 'failed:', content, {
          input: tu.input,
        })
      }
      trace.push(
        isError
          ? `[${tu.name} — ${content.slice(0, 90)} → retrying]`
          : `[${tu.name}]`
      )
      results.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: truncateForModel(content, local),
        ...(isError ? { is_error: true } : {}),
      })
    }
    apiMessages.push({ role: 'user', content: results })
  }

  return {
    message: `${
      finalText ? `${finalText}\n\n` : ''
    }(I stopped after several lookup steps — ask me to continue.)`,
    trace,
  }
}

/** Cheap connectivity check used by the settings view. */
export async function testConnection(
  settings: AssistantSettings
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendChat(settings, 'mint', [{ role: 'user', content: 'Say "ok".' }])
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}
