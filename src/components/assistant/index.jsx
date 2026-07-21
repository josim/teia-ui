import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from '@style'
import { Button } from '@atoms/button'
import { useAssistantStore } from '@context/assistantStore'
import { useMintStore } from '@context/mintStore'
import { useModalStore } from '@context/modalStore'
import { PATH } from '@constants'
import { ASSISTANT_MODES, testConnection } from '@utils/assistant'
import {
  buildMintFields,
  executeAgentSwap,
  validateMintParams,
} from '@utils/assistantMint'
import { executeAgentCancel, executeAgentReswap } from '@utils/assistantSale'

const ACTION_LABELS = {
  prepare_mint: 'Prefill the mint form',
  prepare_swap: 'List for sale',
  prepare_cancel: 'Cancel listing',
  prepare_reswap: 'Change listing price',
}

export const MODE_INTROS = {
  mint: 'Hi — I help you prepare a mint: metadata, editions, royalties, text mints.',
  sale: 'Hi — I help you manage sales: see what you own and have listed, list, delist, or change prices.',
  faq: 'Hi — ask me anything about how Teia works; I answer from the official FAQ and docs.',
  data: 'Hi — I build TezTok data queries for you: sales history, collectors, holdings — with CSV/JSON export.',
}

export const MODE_PLACEHOLDERS = {
  mint: 'Ask about minting…',
  sale: 'Ask about your listings and sales…',
  faq: 'Ask how Teia works…',
  data: 'Describe the data you want…',
}

export const SALE_EXECUTORS = {
  prepare_swap: executeAgentSwap,
  prepare_cancel: executeAgentCancel,
  prepare_reswap: executeAgentReswap,
}

export const validateAction = ({ action, params }) => {
  if (action === 'prepare_mint') {
    return validateMintParams(params)
  }
  if (action === 'prepare_swap') {
    if (!params.objkt_id) return 'Missing OBJKT id'
    if (!(parseFloat(params.price) > 0)) return 'Price must be greater than 0'
    if (!(parseInt(params.amount) >= 1)) return 'Amount must be at least 1'
  }
  if (action === 'prepare_cancel') {
    if (!params.swap_id || !params.contract_address)
      return 'Missing swap id or contract address'
  }
  if (action === 'prepare_reswap') {
    if (!params.objkt_id || params.swap_id === undefined)
      return 'Missing OBJKT id or swap id'
    if (!(parseFloat(params.new_price) > 0))
      return 'New price must be greater than 0'
  }
  return null
}

const PendingAction = () => {
  const navigate = useNavigate()
  const pendingAction = useAssistantStore((st) => st.pendingAction)
  const { dismissAction, logAction, toggle } = useAssistantStore.getState()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)

  if (!pendingAction) return null
  const { action, params } = pendingAction

  const confirm = async () => {
    const invalid = validateAction(pendingAction)
    if (invalid) {
      setProblem(invalid)
      return
    }
    if (action === 'prepare_mint') {
      useMintStore.setState({ ...buildMintFields(params), isValid: false })
      logAction(action, params)
      toggle()
      // state signals the mint page to re-read the store when already mounted
      navigate(PATH.MINT, { state: { assistantPrefill: Date.now() } })
      return
    }
    const executor = SALE_EXECUTORS[action]
    if (executor) {
      setBusy(true)
      setProblem(null)
      try {
        const { error, opHash } = await executor(params)
        if (error) {
          setProblem(error)
        } else if (opHash) {
          logAction(action, params, opHash)
        }
      } catch (e) {
        useModalStore.getState().showError('Assistant', e)
      } finally {
        setBusy(false)
      }
    }
  }

  return (
    <div className={styles.pending}>
      <h3>{ACTION_LABELS[action]}</h3>
      <dl className={styles.pendingParams}>
        {Object.entries(params).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replace(/_/g, ' ')}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
      {problem && <p className={styles.error}>{problem}</p>}
      <div className={styles.pendingButtons}>
        <Button box onClick={confirm} disabled={busy} alt="confirm action">
          {busy ? 'Waiting…' : 'Confirm'}
        </Button>
        <Button onClick={dismissAction} alt="dismiss action">
          Cancel
        </Button>
      </div>
    </div>
  )
}

export const Settings = ({ onDone }) => {
  const settings = useAssistantStore((st) => st.settings)
  const { setSettings, clearChat } = useAssistantStore.getState()
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)

  const test = async () => {
    setTesting(true)
    setResult(null)
    const res = await testConnection(useAssistantStore.getState().settings)
    setResult(res.ok ? 'Connection works.' : `Failed: ${res.error}`)
    setTesting(false)
  }

  return (
    <div className={styles.settings}>
      <h3>Provider</h3>
      <label>
        <input
          type="radio"
          name="assistant-provider"
          checked={settings.provider === 'claude'}
          onChange={() => setSettings({ provider: 'claude' })}
        />
        Claude API (your own key)
      </label>
      <label>
        <input
          type="radio"
          name="assistant-provider"
          checked={settings.provider === 'ollama'}
          onChange={() => setSettings({ provider: 'ollama' })}
        />
        Local Ollama (private)
      </label>

      {settings.provider === 'claude' && (
        <>
          <h3>Anthropic API key</h3>
          <input
            type="password"
            value={settings.apiKey}
            placeholder="sk-ant-…"
            onChange={(e) => setSettings({ apiKey: e.target.value })}
          />
          <p className={styles.hint}>
            Your key is stored only in this browser and sent only to
            api.anthropic.com. Use a key with a low spend limit. Chat history
            never leaves your device.
          </p>
          <h3>Model</h3>
          <input
            type="text"
            value={settings.claudeModel}
            onChange={(e) => setSettings({ claudeModel: e.target.value })}
          />
        </>
      )}

      {settings.provider === 'ollama' && (
        <>
          <h3>Ollama URL</h3>
          <input
            type="text"
            value={settings.ollamaUrl}
            onChange={(e) => setSettings({ ollamaUrl: e.target.value })}
          />
          <h3>Model</h3>
          <input
            type="text"
            value={settings.ollamaModel}
            onChange={(e) => setSettings({ ollamaModel: e.target.value })}
          />
          <p className={styles.hint}>
            Runs fully on your machine — nothing is sent to anyone. Requires{' '}
            Ollama (v0.14+) started with{' '}
            <code>OLLAMA_ORIGINS=https://teia.art</code> (or *). Your browser
            may ask permission to reach your local network — allow it. We
            suggest a tool-capable model like qwen3:8b.
          </p>
        </>
      )}

      <div className={styles.settingsActions}>
        <Button box onClick={test} disabled={testing} alt="test connection">
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
        <Button box onClick={clearChat} alt="clear chat history">
          Clear chat
        </Button>
        <Button box onClick={onDone} alt="back to chat">
          Done
        </Button>
      </div>
      {result && <p className={styles.testResult}>{result}</p>}
    </div>
  )
}

export const AssistantPanel = () => {
  const isOpen = useAssistantStore((st) => st.isOpen)
  const mode = useAssistantStore((st) => st.mode)
  const messages = useAssistantStore((st) => st.messages[st.mode])
  const isLoading = useAssistantStore((st) => st.isLoading)
  const error = useAssistantStore((st) => st.error)
  const settings = useAssistantStore((st) => st.settings)
  const { toggle, sendMessage, setMode } = useAssistantStore.getState()

  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const endRef = useRef(null)

  const configured =
    settings.provider === 'ollama' || settings.apiKey.trim() !== ''

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const onSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    if (!configured) {
      setShowSettings(true)
      return
    }
    sendMessage(input.trim())
    setInput('')
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className={styles.toggle}
        onClick={toggle}
        aria-label="Open the assistant"
      >
        assistant
      </button>
    )
  }

  return (
    <aside className={styles.panel} aria-label="Mint and sale assistant">
      <div className={styles.header}>
        <h2>assistant</h2>
        <div className={styles.headerActions}>
          <Button
            to={PATH.ASSISTANT}
            onTo={toggle}
            alt="open the full assistant page"
          >
            full page
          </Button>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            alt="assistant settings"
            selected={showSettings}
          >
            settings
          </Button>
          <Button onClick={toggle} alt="close assistant">
            close
          </Button>
        </div>
      </div>

      {showSettings ? (
        <Settings onDone={() => setShowSettings(false)} />
      ) : (
        <>
          <div className={styles.modeTabs}>
            {ASSISTANT_MODES.map((m) => (
              <Button
                key={m.id}
                onClick={() => setMode(m.id)}
                selected={mode === m.id}
                alt={`${m.label} mode`}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <p>{MODE_INTROS[mode]}</p>
                <p>
                  I only ever prepare things: you review and sign every action
                  with your own wallet.
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

          <PendingAction />

          <form className={styles.inputRow} onSubmit={onSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={MODE_PLACEHOLDERS[mode]}
              disabled={isLoading}
              aria-label="Message the assistant"
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              send
            </button>
          </form>
        </>
      )}
    </aside>
  )
}

export default AssistantPanel
