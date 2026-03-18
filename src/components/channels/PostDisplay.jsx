import { memo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { HashToURL } from '@utils'
import { walletPreview } from '@utils/string'
import { fetchObjktDetails } from '@data/api'
import { useUserStore } from '@context/userStore'
import styles from '@style'

function renderInlineContent(content) {
  if (!content || !Array.isArray(content)) return null
  return content.map((item, i) => {
    if (item.type === 'text') {
      let node = item.text
      const s = item.styles || {}
      if (s.bold) node = <strong key={i}>{node}</strong>
      if (s.italic) node = <em key={`i${i}`}>{node}</em>
      if (s.underline) node = <u key={`u${i}`}>{node}</u>
      if (s.strikethrough) node = <s key={`s${i}`}>{node}</s>
      if (s.code) node = <code key={`c${i}`}>{node}</code>
      return <span key={i}>{node}</span>
    }
    if (item.type === 'link') {
      return (
        <a key={i} href={item.href} target="_blank" rel="noopener noreferrer">
          {renderInlineContent(item.content)}
        </a>
      )
    }
    if (item.type === 'teiaMention') {
      const { address, name } = item.props || {}
      return (
        <Link key={i} to={`/tz/${address}`} className={styles.mention_inline}>
          @{name || walletPreview(address)}
        </Link>
      )
    }
    return <span key={i}>{item.text || ''}</span>
  })
}

function TokenEmbedDisplay({ props }) {
  const {
    tokenId,
    name,
    artistName,
    artist,
    mimeType,
    displayUri,
    artifactUri,
  } = props || {}
  const [listings, setListings] = useState([])
  const [showListings, setShowListings] = useState(false)
  const collect = useUserStore((st) => st.collect)
  const address = useUserStore((st) => st.address)

  useEffect(() => {
    if (!tokenId) return
    fetchObjktDetails(tokenId).then((nft) => {
      if (nft?.listings?.length) {
        setListings(nft.listings.filter((l) => l.amount_left > 0))
      }
    })
  }, [tokenId])

  if (!tokenId) return null

  const mime = mimeType || ''
  let previewUri = displayUri || ''
  if (mime.startsWith('image/')) previewUri = artifactUri || displayUri || ''

  let media
  if (mime.startsWith('video/') && artifactUri) {
    media = (
      <video
        src={HashToURL(artifactUri)}
        className={styles.token_block_media}
        muted
        loop
        autoPlay
        playsInline
      />
    )
  } else if (mime === 'image/gif' && artifactUri) {
    media = (
      <img
        src={HashToURL(artifactUri)}
        alt=""
        className={styles.token_block_media}
      />
    )
  } else if (previewUri) {
    media = (
      <img
        src={HashToURL(previewUri, 'CDN', { size: 'small' })}
        alt=""
        className={styles.token_block_media}
      />
    )
  }

  return (
    <div className={styles.token_block_preview}>
      {media}
      <div className={styles.token_block_info}>
        <Link to={`/objkt/${tokenId}`} className={styles.token_block_name}>
          {name || `#${tokenId}`}
        </Link>
        {(artistName || artist) && (
          <span className={styles.token_block_artist}>
            by {artistName || walletPreview(artist)}
          </span>
        )}
      </div>
      {listings.length > 0 && (
        <div className={styles.token_block_collect}>
          {!address ? (
            <span className={styles.token_block_collect_hint}>
              Connect wallet to collect
            </span>
          ) : listings.length === 1 ? (
            <button
              type="button"
              className={styles.token_block_collect_btn}
              onClick={() => collect(listings[0])}
            >
              Collect for {listings[0].price / 1e6} tez
            </button>
          ) : (
            <>
              <button
                type="button"
                className={styles.token_block_collect_btn}
                onClick={() => setShowListings(!showListings)}
              >
                Collect ({listings.length} listings)
              </button>
              {showListings && (
                <div className={styles.token_block_listings}>
                  {listings.map((l) => (
                    <button
                      type="button"
                      key={l.swap_id || l.ask_id || l.offer_id}
                      className={styles.token_block_listing_row}
                      onClick={() => collect(l)}
                    >
                      {l.price / 1e6} tez —{' '}
                      {l.seller_profile?.name ||
                        walletPreview(l.seller_address)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MediaEmbedDisplay({ props }) {
  const { ipfsHash, mimeType, fileName } = props || {}
  if (!ipfsHash) return null

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

function renderBlock(block, index) {
  const content = renderInlineContent(block.content)

  switch (block.type) {
    case 'paragraph':
      return <p key={block.id || index}>{content}</p>
    case 'heading': {
      const level = block.props?.level || 2
      const Tag = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
      return <Tag key={block.id || index}>{content}</Tag>
    }
    case 'bulletListItem':
      return <li key={block.id || index}>{content}</li>
    case 'numberedListItem':
      return <li key={block.id || index}>{content}</li>
    case 'codeBlock':
      return (
        <pre key={block.id || index}>
          <code>{block.content?.[0]?.text || ''}</code>
        </pre>
      )
    case 'image':
      return (
        <img
          key={block.id || index}
          src={block.props?.url}
          alt={block.props?.caption || ''}
          style={{ maxWidth: '100%' }}
        />
      )
    case 'teiaToken':
      return <TokenEmbedDisplay key={block.id || index} props={block.props} />
    case 'teiaMedia':
      return <MediaEmbedDisplay key={block.id || index} props={block.props} />
    default:
      return content ? <p key={block.id || index}>{content}</p> : null
  }
}

function groupListItems(blocks) {
  const result = []
  let currentList = null

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type === 'bulletListItem') {
      if (!currentList || currentList.tag !== 'ul') {
        currentList = { tag: 'ul', items: [] }
        result.push(currentList)
      }
      currentList.items.push(block)
    } else if (block.type === 'numberedListItem') {
      if (!currentList || currentList.tag !== 'ol') {
        currentList = { tag: 'ol', items: [] }
        result.push(currentList)
      }
      currentList.items.push(block)
    } else {
      currentList = null
      result.push(block)
    }
  }

  return result
}

function PostDisplay({ blocks }) {
  if (!blocks || !Array.isArray(blocks)) return null

  const grouped = groupListItems(blocks)

  return (
    <div className={styles.post_display}>
      {grouped.map((item, i) => {
        if (item.tag) {
          const Tag = item.tag
          return (
            <Tag key={i}>
              {item.items.map((block, j) => renderBlock(block, j))}
            </Tag>
          )
        }
        return renderBlock(item, i)
      })}
    </div>
  )
}

export default memo(PostDisplay)
