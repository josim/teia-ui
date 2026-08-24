import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Page, Container } from '@atoms/layout'
import { Button } from '@atoms/button'
import { Loading } from '@atoms/loading'
import { Identicon } from '@atoms/identicons'
import { ResponsiveMasonry } from '@components/responsive-masonry'
import { FeedItem } from '@components/feed-item'
import { PATH } from '@constants'
import {
  useCuration,
  useCurationContent,
  useCurationTokens,
  useCurationRoles,
  tokenThumb,
  setCurationHidden,
} from '@data/curations'
import { useUserProfiles } from '@data/roles'
import { useUserStore } from '@context/userStore'
import { walletPreview } from '@utils/string'
import CurationCover from './CurationCover'
import { isPlayable } from '@data/music'
import { openPlayerPopup } from '@utils/player'
import styles from '@style'

/**
 * Month/day block for a linked event.
 */
function EventDate({ startDate }) {
  const date = startDate ? new Date(startDate) : null
  if (!date || Number.isNaN(date.getTime())) {
    return <span className={styles.place_glyph}>◷</span>
  }
  return (
    <span className={styles.place_date}>
      <small>{date.toLocaleDateString(undefined, { month: 'short' })}</small>
      <b>{date.getDate()}</b>
    </span>
  )
}

export default function CurationDetail() {
  const { id } = useParams()
  const curationId = Number(id)
  const address = useUserStore((st) => st.address)
  const navigate = useNavigate()
  const [coverFailed, setCoverFailed] = useState(false)

  const { curation, isLoading } = useCuration(curationId)
  const { data: content } = useCurationContent(curation?.cid)
  const { data: tokens } = useCurationTokens(content?.tokens)
  const { data: roles } = useCurationRoles(address)
  const { data: profiles = {} } = useUserProfiles(
    curation?.owner ? [curation.owner] : []
  )

  if (isLoading) {
    return (
      <Page title="Curation">
        <Container>
          <Loading message="Loading curation" />
        </Container>
      </Page>
    )
  }

  if (!curation) {
    return (
      <Page title="Curation">
        <Container>
          <p className={styles.empty}>Curation not found.</p>
        </Container>
      </Page>
    )
  }

  const canEdit = address === curation.owner || roles?.canModerate

  if (curation.hidden && !canEdit) {
    return (
      <Page title="Curation">
        <Container>
          <p className={styles.empty}>This curation has been hidden.</p>
        </Container>
      </Page>
    )
  }

  const title = content?.title || `Curation ${curation.id}`
  const tokenCount = content?.tokens?.length ?? 0
  const cover = content?.cover_image
  const showCover = Boolean(cover) && !coverFailed
  const headerThumb = content?.cover_thumbnail
    ? tokenThumb(content.cover_thumbnail)
    : tokenThumb(tokens?.[0]?.display_uri || tokens?.[0]?.thumbnail_uri)

  const hasMusic = (tokens || []).some(isPlayable)
  const playerPath = `${PATH.CURATIONS}/${curation.id}/play`
  const openPlayer = () => {
    if (!openPlayerPopup(playerPath)) navigate(playerPath)
  }

  return (
    <Page title={title}>
      <Container>
        <div className={styles.detail_head}>
          <div className={styles.header}>
            <div className={styles.detail_title_group}>
              {showCover ? (
                <CurationCover
                  className={styles.detail_cover}
                  uri={cover}
                  alt={title}
                  onError={() => setCoverFailed(true)}
                />
              ) : headerThumb ? (
                <img
                  className={styles.detail_cover}
                  src={headerThumb}
                  alt={title}
                />
              ) : null}
              <h1>{title}</h1>
            </div>
            {(hasMusic || canEdit) && (
              <div className={styles.detail_actions}>
                {hasMusic && (
                  <Button shadow_box onClick={openPlayer}>
                    ▶ Listen
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button
                      shadow_box
                      to={`${PATH.CURATIONS}/${curation.id}/edit`}
                    >
                      Edit
                    </Button>
                    <Button
                      shadow_box
                      onClick={() =>
                        setCurationHidden({
                          curationId: curation.id,
                          hidden: !curation.hidden,
                        })
                      }
                    >
                      {curation.hidden ? 'Unhide' : 'Hide'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {content?.description && (
            <p className={styles.detail_desc}>{content.description}</p>
          )}

          {(content?.channels?.length > 0 || content?.events?.length > 0) && (
            <div className={styles.places}>
              {content.channels?.map((c) => (
                <Link
                  key={`ch-${c.id}`}
                  to={`/inbox/channels/${c.id}`}
                  className={styles.place}
                >
                  <span className={styles.place_glyph}>#</span>
                  <span className={styles.place_text}>
                    <span className={styles.place_kind}>Channel</span>
                    <span className={styles.place_name}>{c.name}</span>
                    <span className={styles.place_sub}>
                      Discuss this curation
                    </span>
                  </span>
                  <span className={styles.place_arrow}>→</span>
                </Link>
              ))}
              {content.events?.map((e) => (
                <Link
                  key={`ev-${e.slug}`}
                  to={`/calendar/event/${e.slug}`}
                  className={styles.place}
                >
                  <EventDate startDate={e.startDate} />
                  <span className={styles.place_text}>
                    <span className={styles.place_kind}>Event</span>
                    <span className={styles.place_name}>{e.title}</span>
                    <span className={styles.place_sub}>Calendar</span>
                  </span>
                  <span className={styles.place_arrow}>→</span>
                </Link>
              ))}
            </div>
          )}

          {content?.tags?.length > 0 && (
            <div className={styles.chips}>
              {content.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`${PATH.TAGS}/${tag}`}
                  className={styles.chip}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          <div className={styles.detail_meta}>
            <Link
              className={styles.owner_link}
              to={`${PATH.ISSUER}/${curation.owner}/curations`}
            >
              <Identicon
                address={curation.owner}
                logo={profiles[curation.owner]?.logo}
                className={styles.owner_avatar}
              />
              <span>
                by{' '}
                {profiles[curation.owner]?.alias ||
                  walletPreview(curation.owner)}
              </span>
            </Link>
            <span>
              {tokenCount} token{tokenCount === 1 ? '' : 's'}
            </span>
            {curation.hidden && <span>hidden</span>}
          </div>
        </div>

        {!content ? (
          <Loading message="Loading tokens" />
        ) : tokenCount === 0 ? (
          <p className={styles.empty}>This curation has no tokens yet.</p>
        ) : !tokens ? (
          <Loading message="Loading tokens" />
        ) : (
          <ResponsiveMasonry>
            {tokens.map((token) => (
              <FeedItem key={token.key} nft={token} />
            ))}
          </ResponsiveMasonry>
        )}
      </Container>
    </Page>
  )
}
