// Curations write layer.
//
//  - any DAO-token holder calls create_curation
//  - moderators / multisig users may edit/hide any curation
//
// After a write we can't match SWR keys by predicate (swr ^1.3), so we seed the
// immutable doc under its CID key and revalidate the exact keys we can compute.

import { mutate } from 'swr'
import {
  CURATIONS_CONTRACT,
  CURATION_CREATE_FEE,
  CURATION_EDIT_FEE,
} from '@constants'
import { Tezos, useUserStore } from '@context/userStore'
import { useModalStore } from '@context/modalStore'
import { buildCurationDocument, uploadCurationContent } from './ipfs'
import type {
  ChannelRef,
  CurationContent,
  CurationFeeConfig,
  CurationLayout,
  CurationToken,
  EventRef,
} from './types'

function friendlyError(e: unknown): unknown {
  const raw = JSON.stringify(e ?? '')
  if (raw.includes('CUR_NOT_AUTHORIZED') || raw.includes('CUR_NOT_OWNER')) {
    return new Error('You are not authorized to perform this action.')
  }
  if (raw.includes('CUR_NO_TOKENS')) {
    return new Error('You must hold Teia (TEIA) tokens to create a curation.')
  }
  if (raw.includes('CUR_CURATION_NOT_FOUND')) {
    return new Error('That curation no longer exists.')
  }
  if (raw.includes('CUR_INCORRECT_FEE')) {
    return new Error('The attached fee does not match the current fee.')
  }
  if (raw.includes('CUR_PAUSED')) {
    return new Error('Curations are temporarily paused by governance.')
  }
  if (raw.includes('CUR_EMPTY_CID')) {
    return new Error('A title is required.')
  }
  return e
}

export interface CurationInput {
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
}

async function buildAndUpload(
  input: CurationInput
): Promise<{ cid: string; doc: CurationContent }> {
  const editor = useUserStore.getState().address ?? ''
  const doc = buildCurationDocument({
    title: input.title,
    description: input.description,
    coverImage: input.coverImage,
    coverThumbnail: input.coverThumbnail,
    layout: input.layout,
    tokens: input.tokens,
    tags: input.tags,
    channels: input.channels,
    events: input.events,
    fee: input.fee,
    owner: input.owner,
    editor,
  })
  const cid = await uploadCurationContent(doc)
  return { cid, doc }
}

/** Seed the new doc + revalidate the list. */
function invalidateAfterWrite(
  cid: string,
  doc: CurationContent,
  owner: string,
  id?: number
) {
  mutate(`curations:content:${cid}`, doc, false)
  mutate('curations:page:desc:0')
  mutate('curations:page:asc:0')
  mutate(['curations:all', 'desc'])
  mutate(['curations:all', 'asc'])
  mutate(['curations:owner', owner, true])
  mutate(['curations:owner', owner, false])
  if (id != null) mutate(['curations:one', id])
}

export async function createCuration(input: CurationInput) {
  const { step, show, showError } = useModalStore.getState()
  step('Create Curation', 'Uploading to IPFS', true)
  try {
    const address = useUserStore.getState().address ?? ''
    const { cid, doc } = await buildAndUpload({ ...input, owner: address })
    step('Create Curation', 'Waiting for wallet confirmation', false)
    const contract = await Tezos.wallet.at(CURATIONS_CONTRACT)
    const op = await contract.methodsObject
      .create_curation(cid)
      .send({ amount: CURATION_CREATE_FEE, mutez: true })
    step('Create Curation', 'Awaiting confirmation...')
    await op.confirmation()
    invalidateAfterWrite(cid, doc, address)
    show('Create Curation', 'Curation created')
    return op.opHash
  } catch (e) {
    const friendly = friendlyError(e)
    showError('Create Curation', friendly)
    throw friendly
  }
}

export async function updateCuration(
  curationId: number,
  input: CurationInput,
  { asModerator = false }: { asModerator?: boolean } = {}
) {
  const { step, show, showError } = useModalStore.getState()
  step('Update Curation', 'Uploading to IPFS', true)
  try {
    const amount = asModerator ? 0 : CURATION_EDIT_FEE
    const { cid, doc } = await buildAndUpload(input)
    step('Update Curation', 'Waiting for wallet confirmation', false)
    const contract = await Tezos.wallet.at(CURATIONS_CONTRACT)
    const op = await contract.methodsObject
      .update_curation({ curation_id: curationId, cid })
      .send({ amount, mutez: true })
    step('Update Curation', 'Awaiting confirmation...')
    await op.confirmation()
    invalidateAfterWrite(cid, doc, input.owner, curationId)
    show('Update Curation', 'Curation updated')
    return op.opHash
  } catch (e) {
    const friendly = friendlyError(e)
    showError('Update Curation', friendly)
    throw friendly
  }
}

export async function setCurationHidden({
  curationId,
  hidden,
}: {
  curationId: number
  hidden: boolean
}) {
  const { step, show, showError } = useModalStore.getState()
  const title = hidden ? 'Hide Curation' : 'Unhide Curation'
  step(title, 'Waiting for wallet', true)
  try {
    const contract = await Tezos.wallet.at(CURATIONS_CONTRACT)
    const op = await contract.methodsObject
      .set_curation_hidden({ curation_id: curationId, hidden })
      .send()
    step(title, 'Awaiting confirmation...')
    await op.confirmation()
    mutate(['curations:one', curationId])
    mutate('curations:page:desc:0')
    mutate('curations:page:asc:0')
    mutate(['curations:all', 'desc'])
    mutate(['curations:all', 'asc'])
    show(title, hidden ? 'Curation hidden' : 'Curation restored')
    return op.opHash
  } catch (e) {
    const friendly = friendlyError(e)
    showError(title, friendly)
    throw friendly
  }
}

export async function transferCurationOwnership({
  curationId,
  newOwner,
}: {
  curationId: number
  newOwner: string
}) {
  const { step, show, showError } = useModalStore.getState()
  step('Transfer Curation', 'Waiting for wallet', true)
  try {
    const contract = await Tezos.wallet.at(CURATIONS_CONTRACT)
    const op = await contract.methodsObject
      .transfer_curation_ownership({
        curation_id: curationId,
        new_owner: newOwner,
      })
      .send()
    step('Transfer Curation', 'Awaiting confirmation...')
    await op.confirmation()
    mutate(['curations:one', curationId])
    show('Transfer Curation', 'Ownership transferred')
    return op.opHash
  } catch (e) {
    const friendly = friendlyError(e)
    showError('Transfer Curation', friendly)
    throw friendly
  }
}
