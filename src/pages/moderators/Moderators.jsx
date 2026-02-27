import { Outlet } from 'react-router-dom'
import { MODERATOR_CONTRACT } from '@constants'
import { useUserStore } from '@context/userStore'
import { Page } from '@atoms/layout'
import { Loading } from '@atoms/loading'
import { Tabs } from '@atoms/tab'
import {
  useStorage,
  useModeratorProposals,
  useMultisigAddresses,
} from '@data/swr'
import styles from '@style'

const TABS = [
  {
    title: 'Proposals',
    to: '',
  },
  {
    title: 'Submit',
    to: 'submit',
    private: true,
  },
]

export default function Moderators() {
  const [moderatorStorage] = useStorage(MODERATOR_CONTRACT)
  const [proposals] = useModeratorProposals(moderatorStorage)

  const userAddress = useUserStore((st) => st.address)
  const multisigAddresses = useMultisigAddresses()
  const isMultisig = multisigAddresses.includes(userAddress)

  return (
    <Page title="Moderators">
      <div className={styles.container}>
        <h1 className={styles.headline}>Moderators</h1>

        {!proposals ? (
          <div className={styles.loading_container}>
            <Loading message="Loading moderator information" />
          </div>
        ) : (
          <>
            <Tabs
              tabs={TABS}
              filter={(tab) => {
                if (!isMultisig && tab.private) {
                  return null
                }
                return tab
              }}
            />

            <Outlet />
          </>
        )}
      </div>
    </Page>
  )
}
