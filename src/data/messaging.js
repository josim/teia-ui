import useSWR from 'swr'
import { bytes2Char } from '@taquito/utils'
import { TMNT_MESSAGING_CONTRACT } from '@constants'
import { getTzktData } from '@data/api'
import { useStorage } from '@data/swr'

export function useMessagingStorage() {
  return useStorage(TMNT_MESSAGING_CONTRACT)
}

export function useUserThreads(address, storage, offset = 0, limit = 20) {
  const parameters = {
    'key.address_1': address,
    'sort.desc': 'key',
    limit,
    offset,
    active: true,
    select: 'key,value',
  }
  const { data, mutate } = useSWR(
    address && storage?.thread_participants
      ? [`/v1/bigmaps/${storage.thread_participants}/keys`, parameters]
      : null,
    getTzktData
  )

  return [data, mutate]
}

export function useThreadMessages(threadId, storage) {
  // Fetch thread root message
  const { data: rootMessage } = useSWR(
    threadId != null && storage?.messages
      ? `/v1/bigmaps/${storage.messages}/keys/${threadId}`
      : null,
    getTzktData
  )

  // Fetch replies of thread
  const replyParams = {
    'value.parent_id': threadId,
    limit: 10000,
    active: true,
    select: 'key,value',
  }
  const { data: replies, mutate } = useSWR(
    threadId != null && storage?.messages
      ? [`/v1/bigmaps/${storage.messages}/keys`, replyParams]
      : null,
    getTzktData
  )

  let messages = undefined
  if (rootMessage || replies) {
    messages = []

    if (rootMessage?.value) {
      messages.push({
        id: parseInt(rootMessage.key),
        sender: rootMessage.value.sender,
        content: bytes2Char(rootMessage.value.content),
        timestamp: rootMessage.value.timestamp,
        parent_id: null,
      })
    }

    if (replies) {
      replies.forEach((reply) => {
        messages.push({
          id: parseInt(reply.key),
          sender: reply.value.sender,
          content: bytes2Char(reply.value.content),
          timestamp: reply.value.timestamp,
          parent_id: reply.value.parent_id,
        })
      })
    }

    messages.sort((a, b) => a.id - b.id)
  }

  return [messages, mutate]
}

export function useThreadInfo(threadId, storage) {
  const { data, mutate } = useSWR(
    threadId != null && storage?.thread_info
      ? `/v1/bigmaps/${storage.thread_info}/keys/${threadId}`
      : null,
    getTzktData
  )

  return [data?.value, mutate]
}

export function useThreadRecipients(threadId, storage) {
  const parameters = {
    'key.nat': threadId,
    limit: 10000,
    active: true,
    select: 'key,value',
  }
  const { data, mutate } = useSWR(
    threadId != null && storage?.recipients
      ? [`/v1/bigmaps/${storage.recipients}/keys`, parameters]
      : null,
    getTzktData
  )

  const addresses = data
    ? data.map((item) => item.key.address_1 || item.key.address)
    : undefined

  return [addresses, mutate]
}

export function useUnreadCount(address, storage) {
  // Get all messages received
  const receivedParams = {
    'key.address_1': address,
    limit: 10000,
    active: true,
    select: 'key,value',
  }
  const { data: received } = useSWR(
    address && storage?.recipients
      ? [`/v1/bigmaps/${storage.recipients}/keys`, receivedParams]
      : null,
    getTzktData,
    { refreshInterval: 30000 }
  )

  // Get read status
  const readParams = {
    'key.address_1': address,
    limit: 10000,
    active: true,
    select: 'key,value',
  }
  const { data: readStatus } = useSWR(
    address && storage?.read_status
      ? [`/v1/bigmaps/${storage.read_status}/keys`, readParams]
      : null,
    getTzktData,
    { refreshInterval: 30000 }
  )

  let unreadCount = 0
  if (received && readStatus) {
    const readSet = new Set(readStatus.map((item) => item.key.nat))
    const receivedIds = received.map((item) => item.key.nat)
    unreadCount = receivedIds.filter((id) => !readSet.has(id)).length
  } else if (received) {
    unreadCount = received.length
  }

  return unreadCount
}

export function useMessageFee(storage) {
  return storage?.message_fee ? parseInt(storage.message_fee) : 0
}
