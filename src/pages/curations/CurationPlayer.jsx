import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  useCuration,
  useCurationContent,
  useCurationTokens,
} from '@data/curations'
import { isPlayable } from '@data/music'
import { useTitle } from '@hooks/use-title'
import PlayerShell from './PlayerShell'
import styles from '@style'

export default function CurationPlayer() {
  const { id } = useParams()
  const curationId = Number(id)

  const { curation, isLoading } = useCuration(curationId)
  const { data: content } = useCurationContent(curation?.cid)
  const { data: tokens } = useCurationTokens(content?.tokens)

  const title = content?.title || `Curation ${curationId}`
  useTitle(title)

  const tracks = useMemo(() => (tokens || []).filter(isPlayable), [tokens])

  if (isLoading) {
    return <PlayerShell tracks={[]} title={title} isLoading emptyMessage="" />
  }

  if (!curation || curation.hidden) {
    return (
      <div className={styles.player}>
        <p className={styles.empty}>
          {curation ? 'This curation has been hidden.' : 'Curation not found.'}
        </p>
      </div>
    )
  }

  const contentLoading = !content || (content.tokens?.length && !tokens)

  return (
    <PlayerShell
      tracks={tracks}
      title={title}
      isLoading={Boolean(contentLoading)}
      emptyMessage="No music in this curation"
    />
  )
}
