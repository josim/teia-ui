import { Link } from 'react-router-dom'
import { walletPreview } from '@utils/string'
import styles from './ThreadListItem.module.scss'

export default function ThreadListItem({
  threadId,
  lastMessage,
  replyMode,
  isUnread,
  participantCount,
}) {
  const preview = lastMessage?.content
    ? lastMessage.content.length > 100
      ? lastMessage.content.slice(0, 100) + '...'
      : lastMessage.content
    : 'No messages'

  const senderPreview = lastMessage?.sender
    ? walletPreview(lastMessage.sender)
    : ''

  const time = lastMessage?.timestamp
    ? new Date(lastMessage.timestamp).toLocaleDateString()
    : ''

  return (
    <Link
      to={`/messages/thread/${threadId}`}
      className={`${styles.item} ${isUnread ? styles.unread : ''}`}
    >
      <div className={styles.header}>
        <span className={styles.thread_id}>Thread #{threadId}</span>
        <span className={styles.meta}>
          {replyMode && <span className={styles.mode}>{replyMode}</span>}
          {participantCount > 0 && (
            <span className={styles.participants}>
              {participantCount} participant{participantCount !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      </div>
      <div className={styles.preview}>
        {senderPreview && (
          <span className={styles.sender}>{senderPreview}: </span>
        )}
        {preview}
      </div>
      {time && <div className={styles.time}>{time}</div>}
    </Link>
  )
}
