import { fetchGraphQL, fetchObjktDetails } from '@data/api'
import { useUserStore } from '@context/userStore'

const holdingsQuery = `query AgentHoldings($address: String!) {
  holdings(where: {holder_address: {_eq: $address}, amount: {_gt: "0"}}, order_by: {last_received_at: desc}, limit: 50) {
    amount
    token {
      fa2_address
      token_id
      name
      editions
      price
      artist_address
    }
  }
}`

const listingsQuery = `query AgentListings($address: String!) {
  listings(where: {seller_address: {_eq: $address}, status: {_eq: "active"}}, order_by: {created_at: desc}, limit: 50) {
    swap_id
    ask_id
    contract_address
    type
    price
    amount_left
    seller_address
    token {
      fa2_address
      token_id
      name
      artist_address
    }
  }
}`

const requireAddress = () => {
  const { address } = useUserStore.getState()
  if (!address)
    throw new Error(
      'Wallet not synced — ask the user to sync their wallet first'
    )
  return address
}

/** Read tool: the synced wallet's owned editions */
export async function getHoldings(): Promise<string> {
  const address = requireAddress()
  const { data, errors } = await fetchGraphQL(holdingsQuery, 'AgentHoldings', {
    address,
  })
  if (errors) throw new Error('Could not load holdings')
  const rows = (data?.holdings || []).map((h: any) => ({
    objkt_id: h.token?.token_id,
    title: h.token?.name,
    owned: h.amount,
    editions: h.token?.editions,
    is_own_creation: h.token?.artist_address === address,
  }))
  return JSON.stringify({ address, holdings: rows })
}

/** Read tool: the synced wallet's active listings */
export async function getListings(): Promise<string> {
  const address = requireAddress()
  const { data, errors } = await fetchGraphQL(listingsQuery, 'AgentListings', {
    address,
  })
  if (errors) throw new Error('Could not load listings')
  const rows = (data?.listings || []).map((l: any) => ({
    objkt_id: l.token?.token_id,
    title: l.token?.name,
    price_tez: l.price / 1e6,
    amount_left: l.amount_left,
    swap_id: l.swap_id ?? l.ask_id,
    contract_address: l.contract_address,
    type: l.type,
  }))
  return JSON.stringify({ address, listings: rows })
}

/** Execute a confirmed cancel-listing action */
export async function executeAgentCancel(
  params: Record<string, any>
): Promise<{ error?: string; opHash?: string }> {
  const { address, cancel, sync } = useUserStore.getState()
  if (!address) {
    await sync()
    return { error: 'Wallet sync required — confirm again once synced' }
  }
  if (!params.contract_address || params.swap_id === undefined)
    return { error: 'Missing contract address or swap id' }
  const opHash = await cancel(
    String(params.contract_address),
    parseInt(params.swap_id)
  )
  return { opHash: opHash || undefined }
}

/** Execute a confirmed price-change (cancel + relist in one batch) */
export async function executeAgentReswap(
  params: Record<string, any>
): Promise<{ error?: string; opHash?: string }> {
  const { address, reswap, sync } = useUserStore.getState()
  if (!address) {
    await sync()
    return { error: 'Wallet sync required — confirm again once synced' }
  }
  if (!params.objkt_id || params.swap_id === undefined)
    return { error: 'Missing objkt id or swap id' }
  if (!(parseFloat(params.new_price) > 0))
    return { error: 'New price must be greater than 0' }

  const nft = await fetchObjktDetails(String(params.objkt_id))
  if (!nft) return { error: `OBJKT #${params.objkt_id} not found` }
  const swap = (nft.listings || []).find(
    (l: any) => String(l.swap_id) === String(params.swap_id)
  )
  if (!swap)
    return {
      error: `Active listing with swap id ${params.swap_id} not found on OBJKT #${params.objkt_id}`,
    }
  const opHash = await reswap(
    nft,
    Number((parseFloat(params.new_price) * 1e6).toFixed(0)),
    swap
  )
  return { opHash: opHash || undefined }
}
