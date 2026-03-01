import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useUserStore } from '@context/userStore'
import { useMessagingStore } from '@context/messagingStore'
import { Loading } from '@atoms/loading'
import { Button } from '@atoms/button'
import { Textarea } from '@atoms/input'
import MessageBubble from '@components/messaging/MessageBubble'
import {
  useMessagingStorage,
  useThreadMessages,
  useThreadInfo,
  useThreadRecipients,
  useMessageFee,
} from '@data/messaging'
import { useAliases } from '@data/swr'
import styles from './ThreadView.module.scss'

export default function ThreadView() {
  const { threadId } = useParams()
  const address = useUserStore((st) => st.address)
  const { reply, markAsRead, deleteMessage } = useMessagingStore()

  const [storage] = useMessagingStorage()
  const [messages, refreshMessages] = useThreadMessages(
    threadId ? parseInt(threadId) : null,
    storage
  )
  const [threadInfo] = useThreadInfo(
    threadId ? parseInt(threadId) : null,
    storage
  )
  const [recipients] = useThreadRecipients(
    threadId ? parseInt(threadId) : null,
    storage
  )
  const fee = useMessageFee(storage)

  // Resolve aliases for all senders
  const senderAddresses = messages
    ? [...new Set(messages.map((m) => m.sender))]
    : []
  const [aliases] = useAliases(senderAddresses)

  const [replyContent, setReplyContent] = useState('')
  const [sending, setSending] = useState(false)
  const [markedRead, setMarkedRead] = useState(false)

  // Auto mark-as-read on mount
  useEffect(() => {
    if (messages && address && !markedRead) {
      // We'd need the unread message IDs. For now, mark all as read.
      const messageIds = messages.map((m) => m.id)
      if (messageIds.length > 0) {
        markAsRead(messageIds)
        setMarkedRead(true)
      }
    }
  }, [messages, address, markedRead, markAsRead])

  if (!address) {
    return (
      <div className={styles.empty}>Sync your wallet to view messages.</div>
    )
  }

  if (!storage || !messages) {
    return <Loading message="Loading thread..." />
  }

  const handleReply = async () => {
    if (!replyContent.trim()) return
    setSending(true)
    const opHash = await reply(
      parseInt(threadId),
      replyContent,
      recipients || []
    )
    setSending(false)
    if (opHash) {
      setReplyContent('')
      refreshMessages()
    }
  }

  const handleDelete = async (messageId) => {
    await deleteMessage(messageId)
    refreshMessages()
  }

  const replyMode = threadInfo?.reply_mode
  const isPublic =
    replyMode && (replyMode.public !== undefined || replyMode === 'public')

  return (
    <div className={styles.thread}>
      <div className={styles.header}>
        <h2>Thread #{threadId}</h2>
        <div className={styles.meta}>
          {replyMode && <span>{isPublic ? 'Public' : 'Private'} thread</span>}
          {recipients && (
            <span>
              {recipients.length} participant
              {recipients.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className={styles.messages}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender === address}
            onDelete={msg.sender === address ? handleDelete : undefined}
            senderAlias={aliases?.[msg.sender]}
          />
        ))}
      </div>

      <div className={styles.reply_form}>
        <Textarea
          placeholder="Type a reply..."
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          maxlength={16000}
        />
        {fee > 0 && (
          <span className={styles.fee}>Fee: {fee / 1000000} tez</span>
        )}
        <div className={styles.reply_actions}>
          <Button
            onClick={handleReply}
            disabled={sending || !replyContent.trim()}
          >
            {sending ? 'Sending...' : 'Reply'}
          </Button>
        </div>
      </div>
    </div>
  )
}
