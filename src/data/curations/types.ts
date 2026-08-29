// Curations contract + IPFS document types.

export interface CurationToken {
  fa2_address: string
  token_id: string
  fee_mutez?: number
  fee_bps?: number
}

/** A linked messaging channel, denormalized so the read path needs no lookup. */
export interface ChannelRef {
  id: number
  name: string
}

/**
 * A linked calendar event.
 */
export interface EventRef {
  slug: string
  title: string
  image?: string
  startDate?: string
}

export type CurationLayout = 'masonry' | 'list'
export type CurationFeeUnit = 'tez' | 'percent'

export interface CurationFeeConfig {
  mode: 'global' | 'per_token'
  unit?: CurationFeeUnit
  global_mutez: number
  global_bps?: number
}

export interface CurationContent {
  schema_version: number
  title: string
  description: string
  cover_image?: string
  cover_thumbnail?: string
  display: { layout: CurationLayout }
  tokens: CurationToken[]
  tags: string[]
  channels: ChannelRef[]
  events: EventRef[]
  fee: CurationFeeConfig
  owner: string
  editor: string
  timestamp: string
}

export interface Curation {
  id: number
  owner: string
  cid: string
  /** Hidden by the owner. */
  hidden: boolean
  /** Hidden by a Teia moderator / multisig user. Public = !hidden && !moderated. */
  moderated: boolean
}

/** Only used for the migration, will be removed later on */
export interface V1Curation {
  id: number
  owner: string
  cid: string
  migratedTo?: number
}

export interface CurationUserRoles {
  isModerator: boolean
  isMultisig: boolean
  canModerate: boolean
  /** Token gate is off on v4: any synced wallet may create. */
  canCreate: boolean
}
