// Pop-Up Player

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import classnames from 'classnames'
import { Loading } from '@atoms/loading'
import { IconToggle } from '@atoms/toggles'
import { PlayIcon, PauseIcon, SingleViewIcon, MasonryIcon } from '@icons'
import { MIMETYPE } from '@constants'
import { useLocalSettings } from '@context/localSettingsStore'
import { walletPreview } from '@utils/string'
import { HashToURL } from '@utils'
import styles from '@style'

const artistName = (token) =>
  token.artist_profile?.name || walletPreview(token.artist_address)

const coverURL = (token, size) =>
  token.display_uri || token.thumbnail_uri
    ? HashToURL(token.display_uri || token.thumbnail_uri, 'CDN', { size })
    : ''

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const TrackList = memo(function TrackList({ tracks, currentIndex, onSelect }) {
  return (
    <ul className={styles.player_list}>
      {tracks.map((track, index) => (
        <li key={track.key}>
          <button
            type="button"
            className={classnames(styles.player_track, {
              [styles.player_track_active]: index === currentIndex,
            })}
            onClick={() => onSelect(index)}
          >
            <img src={coverURL(track, 'small')} alt="" />
            <span className={styles.player_track_text}>
              <span className={styles.player_track_name}>{track.name}</span>
              <span className={styles.player_track_artist}>
                {artistName(track)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
})

export default function PlayerShell({
  tracks,
  title,
  isLoading,
  emptyMessage = 'No playable tracks',
  headerExtra = null,
}) {
  const audioRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [compact, setCompact] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const { theme, applyTheme } = useLocalSettings.getState()
    applyTheme(theme)
  }, [])

  const track = tracks[currentIndex]
  const src = track ? HashToURL(track.artifact_uri, 'CDN', { size: 'raw' }) : ''

  // Track progress/duration from the media element
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const syncTime = () => setProgress(audio.currentTime)
    const syncDuration = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    syncTime()
    syncDuration()
    audio.addEventListener('timeupdate', syncTime)
    audio.addEventListener('durationchange', syncDuration)
    return () => {
      audio.removeEventListener('timeupdate', syncTime)
      audio.removeEventListener('durationchange', syncDuration)
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !src) return
    if (!isPlaying) {
      audio.pause()
      return
    }
    let superseded = false
    audio.play().catch(() => {
      if (!superseded) setIsPlaying(false)
    })
    return () => {
      superseded = true
    }
  }, [isPlaying, src])

  const selectTrack = useCallback((index) => {
    setCurrentIndex(index)
    setIsPlaying(true)
  }, [])

  const onEnded = () => {
    if (currentIndex < tracks.length - 1) setCurrentIndex(currentIndex + 1)
    else setIsPlaying(false)
  }
  // Lock-screen media controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    const track = tracks[currentIndex]
    if (!track) return

    ms.metadata = new window.MediaMetadata({
      title: track.name || '',
      artist: artistName(track),
      album: title,
      artwork: [{ src: coverURL(track, 'raw'), sizes: '512x512' }],
    })
    ms.playbackState = isPlaying ? 'playing' : 'paused'

    const set = (action, handler) => {
      try {
        ms.setActionHandler(action, handler)
      } catch {
        /* not supported in this browser */
      }
    }
    set('play', () => setIsPlaying(true))
    set('pause', () => setIsPlaying(false))
    set(
      'previoustrack',
      currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : null
    )
    set(
      'nexttrack',
      currentIndex < tracks.length - 1
        ? () => setCurrentIndex(currentIndex + 1)
        : null
    )

    return () => {
      set('play', null)
      set('pause', null)
      set('previoustrack', null)
      set('nexttrack', null)
    }
  }, [tracks, currentIndex, isPlaying, title])

  if (isLoading) {
    return (
      <div className={styles.player}>
        <Loading message="Loading" />
      </div>
    )
  }

  if (!tracks.length) {
    return (
      <div className={styles.player}>
        <h1 className={styles.player_heading}>{title}</h1>
        {headerExtra}
        <p className={styles.empty}>{emptyMessage}</p>
      </div>
    )
  }

  const cover = coverURL(track, 'raw')
  const isVideo = track.mime_type === MIMETYPE.MP4

  return (
    <div
      className={classnames(styles.player, {
        [styles.player_compact]: compact,
      })}
    >
      <div className={styles.player_top}>
        <h1 className={styles.player_heading}>{title}</h1>
        <div className={styles.player_view_toggle}>
          <IconToggle
            alt="large cover view"
            toggled={!compact}
            onClick={() => setCompact(false)}
            icon={<SingleViewIcon />}
          />
          <IconToggle
            alt="compact playlist view"
            toggled={compact}
            onClick={() => setCompact(true)}
            icon={<MasonryIcon />}
          />
        </div>
      </div>

      {headerExtra}

      <div className={styles.player_now}>
        <video
          ref={audioRef}
          className={classnames(styles.player_cover, {
            [styles.player_media_hidden]: !isVideo,
          })}
          src={src}
          poster={cover || undefined}
          preload="metadata"
          playsInline
          onEnded={onEnded}
        />
        {!isVideo &&
          (cover ? (
            <img
              className={styles.player_cover}
              src={cover}
              alt={`cover for ${track.name}`}
            />
          ) : (
            <div className={styles.player_cover} />
          ))}
        <p className={styles.player_name}>{track.name}</p>
        <p className={styles.player_artist}>{artistName(track)}</p>
      </div>

      <div className={styles.player_bar}>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={Number.isFinite(duration) ? duration : 0}
          step={0.1}
          value={progress}
          style={{
            '--pct': duration > 0 ? `${(progress / duration) * 100}%` : '0%',
          }}
          onChange={(e) => {
            const time = Number(e.target.value)
            if (audioRef.current) audioRef.current.currentTime = time
            setProgress(time)
          }}
        />
        <div className={styles.player_times}>
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className={styles.player_controls}>
        <button
          type="button"
          className={styles.player_ctrl}
          aria-label="Previous track"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(currentIndex - 1)}
        >
          &#9198;
        </button>
        <button
          type="button"
          className={classnames(styles.player_ctrl, styles.player_ctrl_main)}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? (
            <PauseIcon fill="var(--text-color)" width={28} height={28} />
          ) : (
            <PlayIcon fill="var(--text-color)" width={28} height={28} />
          )}
        </button>
        <button
          type="button"
          className={styles.player_ctrl}
          aria-label="Next track"
          disabled={currentIndex === tracks.length - 1}
          onClick={() => setCurrentIndex(currentIndex + 1)}
        >
          &#9197;
        </button>
      </div>

      <div className={styles.player_volume}>
        <span>Vol</span>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          style={{ '--pct': `${volume * 100}%` }}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </div>

      <TrackList
        tracks={tracks}
        currentIndex={currentIndex}
        onSelect={selectTrack}
      />
    </div>
  )
}
