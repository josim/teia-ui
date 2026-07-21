import { useEffect, useRef, useState } from 'react'
import { Page } from '@atoms/layout'
import { Button } from '@atoms/button'
import styles from '@style'
import useSettings from '@hooks/use-settings'
import { useAssistantStore } from '@context/assistantStore'
import { useModalStore } from '@context/modalStore'
import { Settings, validateAction } from '@components/assistant'
import {
  artifactNeedsCover,
  executeAgentMint,
  executeAgentSwap,
} from '@utils/assistantMint'

const VISION_MIMETYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_VISION_MB = 5

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const ACTION_LABELS = {
  prepare_mint: 'Mint this OBJKT',
  prepare_swap: 'List for sale',
}

const PendingCard = ({ artifact, cover, onDone }) => {
  const pendingAction = useAssistantStore((st) => st.pendingAction)
  const { dismissAction, logAction } = useAssistantStore.getState()
  const { ignoreUriMap } = useSettings()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)

  if (!pendingAction) return null
  const { action, params } = pendingAction
  const isImage = artifact && VISION_MIMETYPES.includes(artifact.type)

  const confirm = async () => {
    setBusy(true)
    setProblem(null)
    try {
      if (action === 'prepare_mint') {
        const err = await executeAgentMint(
          params,
          artifact,
          cover,
          ignoreUriMap
        )
        if (err) {
          setProblem(err)
        } else {
          logAction(action, params)
          onDone()
        }
      } else if (action === 'prepare_swap') {
        const invalid = validateAction(pendingAction)
        if (invalid) {
          setProblem(invalid)
          return
        }
        const { error, opHash } = await executeAgentSwap(params)
        if (error) {
          setProblem(error)
        } else if (opHash) {
          logAction(action, params, opHash)
        }
      }
    } catch (e) {
      useModalStore.getState().showError('Assistant', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.pending}>
      <h3>{ACTION_LABELS[action]}</h3>
      {action === 'prepare_mint' && params.text_mint && (
        <pre className={styles.previewText}>{params.text_content}</pre>
      )}
      {action === 'prepare_mint' && !params.text_mint && isImage && (
        <img
          className={styles.previewImage}
          src={URL.createObjectURL(artifact)}
          alt="Artwork preview"
        />
      )}
      <dl className={styles.pendingParams}>
        {Object.entries(params)
          .filter(([key]) => key !== 'text_content')
          .map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/_/g, ' ')}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        {action === 'prepare_mint' && !params.text_mint && (
          <div>
            <dt>file</dt>
            <dd>{artifact ? artifact.name : 'none attached yet'}</dd>
          </div>
        )}
        {action === 'prepare_mint' && cover && (
          <div>
            <dt>cover</dt>
            <dd>{cover.name}</dd>
          </div>
        )}
      </dl>
      {problem && <p className={styles.error}>{problem}</p>}
      <div className={styles.pendingButtons}>
        <Button box onClick={confirm} disabled={busy} alt="confirm and sign">
          {busy ? 'Waiting…' : action === 'prepare_mint' ? 'Mint' : 'List'}
        </Button>
        <Button onClick={dismissAction} alt="dismiss action">
          Cancel
        </Button>
      </div>
    </div>
  )
}

export default function Assistant() {
  const messages = useAssistantStore((st) => st.messages)
  const isLoading = useAssistantStore((st) => st.isLoading)
  const error = useAssistantStore((st) => st.error)
  const settings = useAssistantStore((st) => st.settings)
  const pendingAction = useAssistantStore((st) => st.pendingAction)
  const { sendMessage } = useAssistantStore.getState()

  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [artifact, setArtifact] = useState(null)
  const [cover, setCover] = useState(null)
  const [announced, setAnnounced] = useState(true)
  const [coverAnnounced, setCoverAnnounced] = useState(true)

  const artifactInputRef = useRef(null)
  const coverInputRef = useRef(null)
  const endRef = useRef(null)

  const configured =
    settings.provider === 'ollama' || settings.apiKey.trim() !== ''
  const needsCover = artifact && artifactNeedsCover(artifact.type || '')

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (isLoading) return
    if (!configured) {
      setShowSettings(true)
      return
    }
    let text = input.trim()
    let attachment
    if (artifact && !announced) {
      attachment = {
        name: artifact.name,
        mimeType: artifact.type || 'application/octet-stream',
      }
      if (
        VISION_MIMETYPES.includes(artifact.type) &&
        artifact.size / 1e6 <= MAX_VISION_MB
      ) {
        attachment.base64 = await fileToBase64(artifact)
      }
    }
    if (cover && !coverAnnounced) {
      text = `${text}\n[attached cover image: ${cover.name}]`.trim()
    }
    if (!text && !attachment) return
    sendMessage(text, attachment)
    setAnnounced(true)
    setCoverAnnounced(true)
    setInput('')
  }

  return (
    <Page title="Assistant">
      <h1>ASSISTANT</h1>
      <div className={styles.headerRow}>
        <Button
          onClick={() => setShowSettings(!showSettings)}
          alt="assistant settings"
          selected={showSettings}
        >
          settings
        </Button>
      </div>

      {showSettings ? (
        <div className={styles.settingsWrap}>
          <Settings onDone={() => setShowSettings(false)} />
        </div>
      ) : (
        <div className={styles.container}>
          <div className={styles.body}>
            <div className={styles.chatCol}>
              <div className={styles.messages}>
                {messages.length === 0 && (
                  <div className={styles.empty}>
                    <p>
                      Hi — I'm the Teia assistant. Attach your artwork with
                      “attach file” below, tell me about the piece, and I'll
                      help you fill in everything and mint it. I can also list
                      your OBJKTs for sale.
                    </p>
                    <p>
                      Nothing happens without you: you review every action and
                      sign it with your own wallet.
                    </p>
                    {!configured && (
                      <p>To start, add your API key under settings.</p>
                    )}
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`${styles.message} ${
                      msg.role === 'user'
                        ? styles.userMessage
                        : styles.assistantMessage
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
                {isLoading && <div className={styles.loading}>thinking…</div>}
                <div ref={endRef} />
              </div>

              {error && <p className={styles.error}>{error}</p>}
            </div>

            {pendingAction && (
              <div className={styles.side}>
                <PendingCard
                  artifact={artifact}
                  cover={cover}
                  onDone={() => {
                    setArtifact(null)
                    setCover(null)
                  }}
                />
              </div>
            )}
          </div>

          <div className={styles.attachRow}>
            <input
              type="file"
              ref={artifactInputRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setArtifact(file)
                  setAnnounced(false)
                }
                e.target.value = ''
              }}
            />
            <input
              type="file"
              ref={coverInputRef}
              accept="image/jpeg,image/png,image/gif"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setCover(file)
                  setCoverAnnounced(false)
                }
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className={styles.attachButton}
              onClick={() => artifactInputRef.current?.click()}
            >
              attach file
            </button>
            {artifact && (
              <span className={styles.chip}>
                {artifact.name}
                <button
                  type="button"
                  onClick={() => setArtifact(null)}
                  aria-label="remove attached file"
                >
                  ✕
                </button>
              </span>
            )}
            {needsCover && (
              <button
                type="button"
                className={styles.attachButton}
                onClick={() => coverInputRef.current?.click()}
              >
                attach cover
              </button>
            )}
            {cover && (
              <span className={styles.chip}>
                {cover.name}
                <button
                  type="button"
                  onClick={() => setCover(null)}
                  aria-label="remove cover image"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <form className={styles.inputRow} onSubmit={onSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your piece or ask me anything…"
              disabled={isLoading}
              aria-label="Message the assistant"
            />
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && announced)}
            >
              send
            </button>
          </form>
        </div>
      )}
    </Page>
  )
}
