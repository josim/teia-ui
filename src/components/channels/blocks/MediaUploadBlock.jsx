import { useRef, useState } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { uploadFileToIPFSProxy } from '@data/ipfs'
import { HashToURL } from '@utils'
import styles from '../index.module.scss'

const SIZE_LIMITS = {
  'image/': 10 * 1024 * 1024, // 10 MB
  'audio/': 50 * 1024 * 1024, // 50 MB
  'video/': 100 * 1024 * 1024, // 100 MB
}

function getSizeLimit(mimeType) {
  for (const [prefix, limit] of Object.entries(SIZE_LIMITS)) {
    if (mimeType.startsWith(prefix)) return limit
  }
  return SIZE_LIMITS['image/']
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MediaUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return

    const limit = getSizeLimit(file.type)
    if (file.size > limit) {
      setError(`File too large (max ${formatSize(limit)})`)
      return
    }

    if (
      !file.type.startsWith('image/') &&
      !file.type.startsWith('audio/') &&
      !file.type.startsWith('video/')
    ) {
      setError('Only image, audio, and video files are supported')
      return
    }

    setError(null)
    setUploading(true)
    try {
      const cid = await uploadFileToIPFSProxy(
        { blob: file, path: file.name, size: file.size },
        'Uploading media'
      )
      if (cid) {
        onUploaded({
          ipfsHash: `ipfs://${cid}`,
          mimeType: file.type,
          fileName: file.name,
          size: file.size,
        })
      } else {
        setError('Upload failed')
      }
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className={styles.media_uploader}
      contentEditable={false}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {uploading ? (
        <div className={styles.media_uploader_status}>Uploading to IPFS...</div>
      ) : (
        <>
          <button
            type="button"
            className={styles.media_uploader_btn}
            onClick={() => inputRef.current?.click()}
          >
            Drop or click to upload media
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,audio/*,video/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </>
      )}
      {error && <div className={styles.media_uploader_error}>{error}</div>}
    </div>
  )
}

function MediaBlockPreview({ ipfsHash, mimeType, fileName }) {
  const url = HashToURL(ipfsHash)
  const mime = mimeType || ''

  if (mime.startsWith('image/')) {
    return (
      <img src={url} alt={fileName || ''} className={styles.media_block_img} />
    )
  }

  if (mime.startsWith('audio/')) {
    return (
      <div className={styles.media_block_audio}>
        {fileName && (
          <span className={styles.media_block_filename}>{fileName}</span>
        )}
        <audio controls src={url} />
      </div>
    )
  }

  if (mime.startsWith('video/')) {
    return <video controls src={url} className={styles.media_block_video} />
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {fileName || ipfsHash}
    </a>
  )
}

export const MediaUploadBlock = createReactBlockSpec(
  {
    type: 'teiaMedia',
    propSchema: {
      ipfsHash: { default: '' },
      mimeType: { default: '' },
      fileName: { default: '' },
      size: { default: 0 },
    },
    content: 'none',
  },
  {
    render: (props) => {
      if (!props.block.props.ipfsHash) {
        return (
          <MediaUploader
            onUploaded={({ ipfsHash, mimeType, fileName, size }) => {
              props.editor.updateBlock(props.block, {
                props: { ipfsHash, mimeType, fileName, size },
              })
            }}
          />
        )
      }

      return (
        <div contentEditable={false}>
          <MediaBlockPreview {...props.block.props} />
        </div>
      )
    },
  }
)
