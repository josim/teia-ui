import { useState } from 'react'
import { useUserStore } from '@context/userStore'
import { Loading } from '@atoms/loading'
import { Button } from '@atoms/button'
import ThreadListItem from '@components/messaging/ThreadListItem'
import {
  useMessagingStorage,
  useUserThreads,
  useUnreadCount,
} from '@data/messaging'
import styles from './index.module.scss'

export default function Inbox() {
  const address = useUserStore((st) => st.address)
  const [offset, setOffset] = useState(0)
  const [storage] = useMessagingStorage()
  const [threads] = useUserThreads(address, storage, offset)
  const unreadCount = useUnreadCount(address, storage)

  if (!address) {
    return (
      <div className={styles.empty}>Sync your wallet to view messages.</div>
    )
  }

  if (!storage) {
    return <Loading message="Loading messaging..." />
  }

  if (!threads) {
    return <Loading message="Loading threads..." />
  }

  if (threads.length === 0 && offset === 0) {
    return (
      <div className={styles.empty}>No messages yet. Start a conversation!</div>
    )
  }

  return (
    <div>
      {unreadCount > 0 && (
        <p style={{ marginBottom: 12 }}>
          {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
        </p>
      )}
      {threads.map((thread) => {
        const threadId =
          thread.key?.nat ||
          thread.key?.nat_1 ||
          thread.value?.thread_id ||
          thread.key
        return (
          <ThreadListItem
            key={
              typeof threadId === 'object' ? JSON.stringify(threadId) : threadId
            }
            threadId={threadId}
            lastMessage={thread.value?.last_message}
            replyMode={thread.value?.reply_mode}
            isUnread={thread.value?.unread}
            participantCount={thread.value?.participant_count || 0}
          />
        )
      })}
      {threads.length >= 20 && (
        <div className={styles.load_more}>
          <Button onClick={() => setOffset(offset + 20)} secondary>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
