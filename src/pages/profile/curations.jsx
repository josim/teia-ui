import { useOutletContext } from 'react-router'
import { Loading } from '@atoms/loading'
import { useCurationsByOwner } from '@data/curations'
import { useUserStore } from '@context/userStore'
import CurationGrid from '../curations/CurationGrid'

/** Profile "Curations" tab. Hidden curations are only displayed to the owner */
export default function ProfileCurations() {
  const { address } = useOutletContext()
  const viewer = useUserStore((st) => st.address)
  const isOwner = Boolean(viewer && viewer === address)
  const { curations, error, isLoading } = useCurationsByOwner(address, isOwner)

  if (isLoading) {
    return <Loading message="Loading curations" />
  }

  if (error) {
    return <p style={{ paddingTop: '2rem' }}>Could not load curations.</p>
  }

  return (
    <div style={{ paddingTop: '2rem' }}>
      <CurationGrid curations={curations} emptyMessage="No curations yet." />
    </div>
  )
}
