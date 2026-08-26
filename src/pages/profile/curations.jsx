import { useOutletContext } from 'react-router'
import { Loading } from '@atoms/loading'
import { useCurationsByOwner } from '@data/curations'
import { useUserStore } from '@context/userStore'
import CurationGrid from '../curations/CurationGrid'
import MigrationNotice from '../curations/MigrationNotice'

/** Profile "Curations" tab. Hidden curations are only displayed to the owner */
export default function ProfileCurations() {
  const { address } = useOutletContext()
  const viewer = useUserStore((st) => st.address)
  const isOwner = Boolean(viewer && viewer === address)
  const { curations, error, isLoading } = useCurationsByOwner(address, isOwner)

  // Same width cap as the profile tab bar (.menu), which Page centers.
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 'var(--max-width-internal)',
        paddingTop: '2rem',
      }}
    >
      {isLoading ? (
        <Loading message="Loading curations" />
      ) : error ? (
        <p>Could not load curations.</p>
      ) : (
        <>
          {isOwner && <MigrationNotice address={viewer} />}
          <CurationGrid
            curations={curations}
            emptyMessage="No curations yet."
          />
        </>
      )}
    </div>
  )
}
