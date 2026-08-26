import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PATH } from '@constants'
import {
  useCurationContent,
  useCurationCardToken,
  tokenThumb,
} from '@data/curations'
import CurationCover from './CurationCover'
import styles from '@style'

export default function CurationCard({ curation }) {
  const { data: content } = useCurationContent(curation.cid)
  const [coverFailed, setCoverFailed] = useState(false)

  const title = content?.title || `Curation ${curation.id}`
  const tokenCount = content?.tokens?.length ?? 0

  const cover = content?.cover_image
  const showCover = Boolean(cover) && !coverFailed
  const thumb = content?.cover_thumbnail
    ? tokenThumb(content.cover_thumbnail)
    : ''

  // Only fetch the first token when there's no cover to show.
  const firstRef =
    !showCover && !thumb && tokenCount > 0 ? content.tokens[0] : undefined
  const { data: firstToken } = useCurationCardToken(firstRef)
  const firstThumb = firstToken
    ? tokenThumb(firstToken.display_uri || firstToken.thumbnail_uri)
    : ''

  const fallbackThumb = thumb || firstThumb

  return (
    <Link className={styles.card} to={`${PATH.CURATIONS}/${curation.id}`}>
      {showCover ? (
        <CurationCover
          className={styles.cover}
          uri={cover}
          alt={title}
          onError={() => setCoverFailed(true)}
        />
      ) : fallbackThumb ? (
        <img
          className={styles.cover}
          src={fallbackThumb}
          alt={title}
          loading="lazy"
        />
      ) : (
        <div className={styles.cover}>
          {content ? `${tokenCount} token${tokenCount === 1 ? '' : 's'}` : '…'}
        </div>
      )}
      <div className={styles.card_body}>
        <h3 className={styles.card_title}>
          {title}
          {curation.hidden && (
            <span className={styles.hidden_badge}>hidden</span>
          )}
          {curation.moderated && (
            <span className={styles.hidden_badge}>moderated</span>
          )}
        </h3>
        <div className={styles.card_meta}>
          {tokenCount} token{tokenCount === 1 ? '' : 's'}
        </div>
      </div>
    </Link>
  )
}
