import { Button } from '@atoms/button'
import { walletPreview } from '@utils/string'
import styles from './MessageBubble.module.scss'

export default function MessageBubble({
  message,
  isOwn,
  onDelete,
  senderAlias,
}) {
  const displayName = senderAlias || walletPreview(message.sender)
  const time = new Date(message.timestamp).toLocaleString()

  return (
    <div
      className={`${styles.bubble} ${
        isOwn ? styles.bubble_mine : styles.bubble_other
      }`}
    >
      {!isOwn && (
        <div className={styles.sender}>
          <Button to={`/tz/${message.sender}`}>{displayName}</Button>
        </div>
      )}
      <div className={styles.content}>{message.content}</div>
      <div className={styles.footer}>
        <span className={styles.timestamp}>{time}</span>
        {isOwn && onDelete && (
          <button
            className={styles.delete_btn}
            onClick={() => onDelete(message.id)}
            aria-label="Delete message"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
