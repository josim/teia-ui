// Moderation console tab

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@atoms/button'
import { Loading } from '@atoms/loading'
import { PATH } from '@constants'
import {
  useCurationsAdmin,
  useCurationContent,
  setCurationModerated,
} from '@data/curations'
import { useUserProfiles } from '@data/roles'
import { walletPreview } from '@utils/string'
import ModerationTable from './ModerationTable'
import styles from '@style'

function TitleCell({ cid, id }) {
  const { data: content } = useCurationContent(cid)
  return <>{content?.title || `Curation ${id}`}</>
}

export default function CurationsAdmin() {
  const { curations, isLoading, mutate } = useCurationsAdmin()
  const { data: profiles = {} } = useUserProfiles([
    ...new Set(curations.map((c) => c.owner)),
  ])
  const [busyId, setBusyId] = useState(null)

  const toggleModerated = async (c) => {
    setBusyId(c.id)
    try {
      await setCurationModerated({ curationId: c.id, moderated: !c.moderated })
      mutate()
    } catch {
      // surfaced via the modal store
    } finally {
      setBusyId(null)
    }
  }

  // ModerationTable's "hidden only" toggle keys off `hidden`; here that means moderated.
  const items = curations.map((c) => ({ ...c, hidden: c.moderated }))

  const renderRow = (c) => (
    <tr key={c.id} className={c.moderated ? styles.row_hidden : ''}>
      <td className={styles.mono}>
        <Link to={`${PATH.CURATIONS}/${c.id}`}>#{c.id}</Link>
      </td>
      <td className={styles.cell_content}>
        <TitleCell cid={c.cid} id={c.id} />
        {c.moderated && <span className={styles.hidden_tag}> (moderated)</span>}
      </td>
      <td>
        <Link to={`${PATH.ISSUER}/${c.owner}/curations`}>
          {profiles[c.owner]?.alias || walletPreview(c.owner)}
        </Link>
      </td>
      <td className={styles.muted}>{c.hidden ? 'hidden by owner' : ''}</td>
      <td className={styles.row_actions}>
        <Button
          small
          shadow_box
          disabled={busyId === c.id}
          onClick={() => toggleModerated(c)}
        >
          {c.moderated ? 'Unmoderate' : 'Moderate'}
        </Button>
      </td>
    </tr>
  )

  return (
    <div className={styles.tab_body}>
      <h3 className={styles.section_head}>Recent curations</h3>
      {isLoading ? (
        <Loading message="Loading curations…" />
      ) : (
        <ModerationTable
          items={items}
          headers={['Id', 'Title', 'Owner', 'Owner flag', 'Actions']}
          renderRow={renderRow}
          searchText={(c) =>
            `${c.id} ${c.owner} ${profiles[c.owner]?.alias ?? ''}`
          }
          emptyLabel="No curations match."
        />
      )}
    </div>
  )
}
