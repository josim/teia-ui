import { useEffect, useState } from 'react'
import { useAccountRoles } from '@data/roles'
import { resolveVerifiedBluesky } from '@utils/bsky'
import { useParams, Link } from 'react-router-dom'
import useSWR from 'swr'
import { Page, Container } from '@atoms/layout'
import { Button } from '@atoms/button'
import { Loading } from '@atoms/loading'
import { Checkbox } from '@atoms/input'
import { getUser } from '@data/api'
import { useArtistExtras, useArtistPreviews } from '@data/artists'
import ArtistCard, {
  CARD_FIELDS,
  DEFAULT_SHOW,
  draftKey,
  readDraft,
} from './ArtistCard'
import styles from './index.module.scss'

/**
 * "Customize my card": pick which profile fields show on your artist card,
 * with a live preview. Saves a local draft for now; the on-chain write goes
 * through the subjkt registry (see pages/config/Subjkt.tsx) as `card.show`.
 */
export default function ConfigureArtistCard() {
  const { name } = useParams()
  const { data: user, error } = useSWR(['configure-artist', name], () =>
    getUser(name, 'name')
  )
  const address = user?.user_address
  const { data: extras } = useArtistExtras(address ? [address] : [], true)
  const { data: tokens } = useArtistPreviews(address)

  const [show, setShow] = useState(null)
  const [saved, setSaved] = useState(false)

  // What this artist actually has linked, so each checkbox can warn when
  // turning it on would show nothing.
  const roles = useAccountRoles(address)
  const [bsky, setBsky] = useState(undefined)
  useEffect(() => {
    if (!address) return
    resolveVerifiedBluesky(address).then(setBsky)
  }, [address])
  const ex = extras?.[address] ?? {}
  const available = {
    bio: Boolean(user?.metadata?.data?.description),
    roles: Boolean(
      roles.isModerator || roles.isMultisig || roles.isTokenHolder
    ),
    domain: Boolean(ex.domain),
    twitter: Boolean(ex.twitter),
    bluesky: bsky === undefined ? undefined : Boolean(bsky?.handle),
    discord: Boolean(ex.discord),
    github: Boolean(ex.github),
    baker: Boolean(ex.baker),
    teia: (ex.teia ?? 0) > 0,
    since: Boolean(ex.since),
  }
  useEffect(() => {
    if (!address) return
    setShow(
      readDraft(address)?.show ??
        user.metadata?.data?.card?.show ??
        DEFAULT_SHOW
    )
  }, [address, user])

  if (error) return <Page title="Customize card">User not found.</Page>
  if (!user || !show) return <Loading message="Loading profile" />

  const artist = {
    address,
    name: user.name,
    description: user.metadata?.data?.description,
    identicon: user.metadata?.data?.identicon,
    tokens: tokens ?? [],
  }
  const toggle = (key) => {
    setSaved(false)
    setShow((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }
  const saveDraft = () => {
    localStorage.setItem(draftKey(address), JSON.stringify({ show }))
    setSaved(true)
  }

  return (
    <Page title="Customize card">
      <Container>
        <div className={styles.page}>
          <h1 className={styles.heading}>Customize my card</h1>
          <p className={styles.subheading}>
            Choose what shows on your card in the{' '}
            <Link to="/artists">Artists</Link> directory.
          </p>
          <div className={styles.configure}>
            <div className={styles.configure_options}>
              {CARD_FIELDS.map((f) => (
                <div key={f.key} className={styles.configure_field}>
                  <Checkbox
                    checked={show.includes(f.key)}
                    onCheck={() => toggle(f.key)}
                    label={f.label}
                  />
                  {extras && available[f.key] === false && (
                    <span className={styles.configure_warn}>
                      nothing linked
                    </span>
                  )}
                </div>
              ))}
              <div className={styles.configure_actions}>
                <Button shadow_box onClick={saveDraft}>
                  {saved ? 'Saved' : 'Save draft'}
                </Button>
                <Button shadow_box disabled title="On-chain save coming next">
                  Save on-chain
                </Button>
              </div>
              <p className={styles.note}>
                Draft is stored in this browser only. Saving on-chain will write
                it to your subjkt metadata.
              </p>
            </div>
            <div className={styles.configure_preview}>
              <ArtistCard
                artist={artist}
                extras={extras?.[address]}
                show={show}
              />
            </div>
          </div>
        </div>
      </Container>
    </Page>
  )
}
