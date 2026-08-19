// Curation IPFS document + gateway helpers

import { uploadMsgJsonToIPFS } from '@data/messaging/ipfs'
import type {
  ChannelRef,
  CurationContent,
  CurationFeeConfig,
  CurationFeeUnit,
  CurationLayout,
  CurationToken,
  EventRef,
} from './types'

const MSG_PROXY =
  import.meta.env.VITE_IPFS_MSG_UPLOAD_PROXY || 'https://ipfsmsg.teia.art'

export const CURATION_SCHEMA_VERSION = 2

/** Upper bounds for the fee inputs. */
export const MAX_FEE_TEZ = 20_000_000
export const MAX_FEE_PERCENT = 100

const stripIpfs = (uri: string) => uri.replace('ipfs://', '')

export function curationIpfsUrl(uri?: string): string {
  if (!uri) return ''
  return `${MSG_PROXY}/ipfs/${stripIpfs(uri)}`
}

export function tokenThumb(previewUri?: string | null): string {
  const proxy = import.meta.env.VITE_IMGPROXY
  return proxy && previewUri ? `${proxy}${previewUri}` : ''
}

export function normalizeFee(fee?: CurationFeeConfig | null): {
  mode: 'global' | 'per_token'
  unit: CurationFeeUnit
  globalMutez: number
  globalBps: number
} {
  return {
    mode: fee?.mode === 'per_token' ? 'per_token' : 'global',
    unit: fee?.unit === 'percent' ? 'percent' : 'tez',
    globalMutez: fee?.global_mutez ?? 0,
    globalBps: fee?.global_bps ?? 0,
  }
}

export async function fetchCurationContent(
  cid: string
): Promise<CurationContent> {
  const res = await fetch(curationIpfsUrl(cid))
  if (!res.ok) throw new Error(`Curation doc ${cid}: HTTP ${res.status}`)
  const doc = (await res.json()) as CurationContent
  return {
    ...doc,
    tokens: doc.tokens ?? [],
    tags: doc.tags ?? [],
    channels: doc.channels ?? [],
    events: doc.events ?? [],
  }
}

export function buildCurationDocument({
  title,
  description,
  coverImage,
  coverThumbnail,
  layout,
  tokens,
  tags,
  channels,
  events,
  fee,
  owner,
  editor,
}: {
  title: string
  description: string
  coverImage?: string
  coverThumbnail?: string
  layout: CurationLayout
  tokens: CurationToken[]
  tags: string[]
  channels: ChannelRef[]
  events: EventRef[]
  fee: CurationFeeConfig
  owner: string
  editor: string
}): CurationContent {
  return {
    schema_version: CURATION_SCHEMA_VERSION,
    title,
    description,
    ...(coverImage ? { cover_image: coverImage } : {}),
    ...(coverThumbnail ? { cover_thumbnail: coverThumbnail } : {}),
    display: { layout },
    tokens,
    tags,
    channels,
    events,
    fee,
    owner,
    editor,
    timestamp: new Date().toISOString(),
  }
}

export async function uploadCurationContent(
  doc: CurationContent
): Promise<string> {
  const uri = await uploadMsgJsonToIPFS(
    doc as unknown as Record<string, unknown>
  )
  return uri.replace('ipfs://', '')
}
