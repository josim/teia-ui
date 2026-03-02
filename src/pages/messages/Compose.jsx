import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUserStore } from '@context/userStore'
import { useMessagingStore } from '@context/messagingStore'
import { Button } from '@atoms/button'
import RecipientInput from '@components/messaging/RecipientInput'
import { useMessagingStorage, useMessageFee } from '@data/messaging'
import styles from './Compose.module.scss'

export default function Compose() {
  const address = useUserStore((st) => st.address)
  const sendMessage = useMessagingStore((st) => st.sendMessage)
  const navigate = useNavigate()
  const { prefillAddress } = useParams()

  const [recipients, setRecipients] = useState(
    prefillAddress ? [prefillAddress] : ['']
  )
  const [content, setContent] = useState('')
  const [replyMode, setReplyMode] = useState('private')
  const [sending, setSending] = useState(false)

  const [storage] = useMessagingStorage()
  const fee = useMessageFee(storage)

  if (!address) {
    return (
      <div className={styles.empty_state}>
        <p>Sync your wallet to send messages.</p>
      </div>
    )
  }

  const updateRecipient = (index, value) => {
    const updated = [...recipients]
    updated[index] = value
    setRecipients(updated)
  }

  const removeRecipient = (index) => {
    if (recipients.length <= 1) return
    setRecipients(recipients.filter((_, i) => i !== index))
  }

  const addRecipient = () => {
    setRecipients([...recipients, ''])
  }

  const handleSend = async () => {
    const validRecipients = recipients.filter((r) => r.length > 0)
    if (validRecipients.length === 0 || !content.trim()) return

    setSending(true)
    const opHash = await sendMessage(content, validRecipients, replyMode)
    setSending(false)

    if (opHash) {
      navigate('/messages')
    }
  }

  const maxChars = 16000
  const isValid =
    content.trim().length > 0 && recipients.some((r) => r.length > 0)

  return (
    <div className={styles.compose}>
      <div className={styles.header_fields}>
        <div className={styles.field_row}>
          <span className={styles.field_label} id="recipients-label">
            To
          </span>
          <div
            className={styles.field_value}
            aria-labelledby="recipients-label"
          >
            <div className={styles.recipients_list}>
              {recipients.map((r, i) => (
                <RecipientInput
                  key={i}
                  index={i}
                  value={r}
                  onChange={(val) => updateRecipient(i, val)}
                  onRemove={recipients.length > 1 ? removeRecipient : undefined}
                />
              ))}
            </div>
            <button
              className={styles.add_btn}
              onClick={addRecipient}
              type="button"
            >
              + Add
            </button>
          </div>
        </div>

        <div className={styles.field_row}>
          <label className={styles.field_label} htmlFor="reply-mode-toggle">
            Mode
          </label>
          <div className={styles.field_value} id="reply-mode-toggle">
            <button
              type="button"
              className={`${styles.mode_btn} ${
                replyMode === 'private' ? styles.mode_active : ''
              }`}
              onClick={() => setReplyMode('private')}
            >
              Private
            </button>
            <button
              type="button"
              className={`${styles.mode_btn} ${
                replyMode === 'public' ? styles.mode_active : ''
              }`}
              onClick={() => setReplyMode('public')}
            >
              Public
            </button>
            <span className={styles.mode_hint}>
              {replyMode === 'private'
                ? 'Only recipients can reply'
                : 'Anyone can reply'}
            </span>
          </div>
        </div>
      </div>
      <div className={styles.body}>
        <textarea
          className={styles.body_input}
          placeholder="Write your message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={maxChars}
        />
      </div>
      <div className={styles.toolbar}>
        <Button onClick={handleSend} disabled={sending || !isValid} shadow_box>
          {sending ? 'Sending...' : 'Send'}
        </Button>
        <div className={styles.toolbar_meta}>
          {fee > 0 && (
            <span className={styles.meta_item}>Fee: {fee / 1000000} tez</span>
          )}
          <span className={styles.meta_item}>
            {content.length.toLocaleString()}/{maxChars.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
