import { create } from 'zustand'
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware'
import {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  sendChat,
} from '@utils/assistant'
import type {
  AssistantAction,
  AssistantMode,
  AssistantSettings,
  ChatAttachment,
  ChatMessage,
} from '@utils/assistant'

/** Per-mode caps keep localStorage small and the loop context bounded. */
const MODE_CAPS: Record<AssistantMode, number> = {
  mint: 60,
  sale: 30,
  faq: 20,
  data: 20,
}
const MAX_LOG = 50

const emptyThreads = (): Record<AssistantMode, ChatMessage[]> => ({
  mint: [],
  sale: [],
  faq: [],
  data: [],
})

interface ActionLogEntry {
  date: string
  action: string
  params: Record<string, any>
  opHash?: string
}

interface AssistantState {
  settings: AssistantSettings
  messages: Record<AssistantMode, ChatMessage[]>
  /** Memory of what the user used the assistant for */
  actionLog: ActionLogEntry[]

  // transient
  mode: AssistantMode
  isOpen: boolean
  isLoading: boolean
  error?: string
  pendingAction?: AssistantAction

  toggle: () => void
  setMode: (mode: AssistantMode) => void
  setSettings: (settings: Partial<AssistantSettings>) => void
  sendMessage: (content: string, attachment?: ChatAttachment) => Promise<void>
  dismissAction: () => void
  logAction: (
    action: string,
    params: Record<string, any>,
    opHash?: string
  ) => void
  clearChat: () => void
}

const defaultSettings: AssistantSettings = {
  provider: 'claude',
  apiKey: '',
  claudeModel: DEFAULT_CLAUDE_MODEL,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
}

export const useAssistantStore = create<AssistantState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        settings: defaultSettings,
        messages: emptyThreads(),
        actionLog: [],

        mode: 'mint' as AssistantMode,
        isOpen: false,
        isLoading: false,
        error: undefined,
        pendingAction: undefined,

        toggle: () => set({ isOpen: !get().isOpen }),

        setMode: (mode) =>
          set({ mode, pendingAction: undefined, error: undefined }),

        setSettings: (settings) =>
          set({ settings: { ...get().settings, ...settings } }),

        sendMessage: async (content, attachment) => {
          const { settings, messages, mode } = get()
          const cap = MODE_CAPS[mode]
          const text = attachment
            ? `${content}\n[attached file: ${attachment.name} (${attachment.mimeType})]`.trim()
            : content
          const thread = [
            ...messages[mode],
            { role: 'user' as const, content: text },
          ].slice(-cap)
          set({
            messages: { ...messages, [mode]: thread },
            isLoading: true,
            error: undefined,
            pendingAction: undefined,
          })
          try {
            const { message, action, trace } = await sendChat(
              settings,
              mode,
              thread,
              attachment
            )
            const reply =
              (message ||
                (action ? 'Here is what I prepared — please review.' : '…')) +
              (trace.length ? `\n\n${trace.join(' ')}` : '')
            set({
              messages: {
                ...get().messages,
                [mode]: [
                  ...thread,
                  { role: 'assistant' as const, content: reply },
                ].slice(-cap),
              },
              pendingAction: action,
              isLoading: false,
            })
          } catch (e: any) {
            set({ isLoading: false, error: e?.message || String(e) })
          }
        },

        dismissAction: () => set({ pendingAction: undefined }),

        logAction: (action, params, opHash) =>
          set({
            actionLog: [
              ...get().actionLog,
              { date: new Date().toISOString(), action, params, opHash },
            ].slice(-MAX_LOG),
            pendingAction: undefined,
          }),

        clearChat: () => {
          const { messages, mode } = get()
          set({
            messages: { ...messages, [mode]: [] },
            pendingAction: undefined,
            error: undefined,
          })
        },
      }),
      {
        name: 'assistant',
        storage: createJSONStorage(() => localStorage),
        version: 2,
        migrate: (persisted: any, version) => {
          if (version < 2 && persisted) {
            // v1 kept a single flat message array — move it to the mint thread
            const old = Array.isArray(persisted.messages)
              ? persisted.messages
              : []
            persisted.messages = { ...emptyThreads(), mint: old }
          }
          return persisted
        },
        partialize: (state) => ({
          settings: state.settings,
          messages: state.messages,
          actionLog: state.actionLog,
        }),
      }
    )
  )
)
