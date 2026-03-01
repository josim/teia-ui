import { Outlet } from 'react-router-dom'
import { Page } from '@atoms/layout'
import { Tabs } from '@atoms/tab'
import { useUserStore } from '@context/userStore'
import styles from './index.module.scss'

const TABS = [
  { title: 'Inbox', to: '' },
  { title: 'Compose', to: 'compose', private: true },
]

export default function Messages() {
  const address = useUserStore((st) => st.address)

  return (
    <Page title="Messages">
      <div className={styles.container}>
        <h1 className={styles.headline}>Messages</h1>
        <Tabs
          tabs={TABS}
          filter={(tab) => {
            if (!address && tab.private) return null
            return tab
          }}
        />
        <div className={styles.tab_content}>
          <Outlet />
        </div>
      </div>
    </Page>
  )
}
