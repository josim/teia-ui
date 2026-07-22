import { useState } from 'react'
import classnames from 'classnames'
import OverviewSection from './OverviewSection'
import SalesSection from './SalesSection'
import ChannelStatsSection from './ChannelStatsSection'
import PollStatsSection from './PollStatsSection'
import TokenStatsSection from './TokenStatsSection'
import styles from '@style'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sales', label: 'Sales' },
  { key: 'channels', label: 'Channels & DMs' },
  { key: 'poll', label: 'Poll comments' },
  { key: 'token', label: 'Token comments' },
]

export default function StatsPage() {
  const [tab, setTab] = useState('overview')

  return (
    <div className={styles.stats}>
      <header className={styles.header}>
        <h2 className={styles.title}>Stats</h2>
      </header>

      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={classnames(styles.tab, {
              [styles.tab_active]: tab === t.key,
            })}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={styles.panel}>
        {tab === 'overview' && <OverviewSection />}
        {tab === 'sales' && <SalesSection />}
        {tab === 'channels' && <ChannelStatsSection />}
        {tab === 'poll' && <PollStatsSection />}
        {tab === 'token' && <TokenStatsSection />}
      </div>
    </div>
  )
}
