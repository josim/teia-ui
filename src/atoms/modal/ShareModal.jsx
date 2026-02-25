import { useEffect } from 'react'
import useClipboard from 'react-use-clipboard'
import { AnimatePresence, motion } from 'framer-motion'
import { fadeIn } from '@utils/motion'
import { HashToURL } from '@utils'
import styles from './ShareModal.module.scss'

export default function ShareModal({
  isOpen,
  onClose,
  url,
  title,
  displayUri,
  artistName,
  onShareOnBlog,
}) {
  const imageUrl = displayUri ? HashToURL(displayUri) : null
  const [isCopied, setCopied] = useClipboard(url, { successDuration: 2000 })

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          onClick={handleOverlayClick}
          {...fadeIn()}
        >
          <div className={styles.modal}>
            <div className={styles.header}>
              <h3>Share</h3>
              <button
                className={styles.close_btn}
                onClick={onClose}
                aria-label="Close share modal"
              >
                ×
              </button>
            </div>

            <div className={styles.preview}>
              {imageUrl && (
                <img
                  className={styles.image}
                  src={imageUrl}
                  alt={title || 'Token preview'}
                />
              )}
              {title && <p className={styles.token_name}>{title}</p>}
              {artistName && <p className={styles.artist}>by {artistName}</p>}
            </div>

            <div className={styles.actions}>
              {onShareOnBlog && (
                <button
                  className={styles.share_btn}
                  onClick={() => {
                    onShareOnBlog()
                    onClose()
                  }}
                >
                  Share on Teia Blogs
                </button>
              )}
              <button
                className={`${styles.share_btn} ${
                  isCopied ? styles.copied : ''
                }`}
                onClick={setCopied}
              >
                {isCopied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
