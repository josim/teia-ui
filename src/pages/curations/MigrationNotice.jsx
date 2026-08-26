import { Link } from 'react-router-dom'
import { PATH } from '@constants'
import { useV1Migration } from '@data/curations'
import styles from '@style'

/** One-line pointer to /curations/migrate, shown only while the synced wallet still has un-migrated v1 curations.  - Will be removed later*/
export default function MigrationNotice({ address }) {
  const { pending } = useV1Migration(address)
  if (pending.length === 0) return null
  return (
    <p className={styles.notice}>
      You have {pending.length} curation{pending.length === 1 ? '' : 's'} on the
      old contract. <Link to={`${PATH.CURATIONS}/migrate`}>Migrate them →</Link>
    </p>
  )
}
