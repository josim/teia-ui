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
  AssistantSettings,
  ChatAttachment,
  ChatMessage,
} from '@utils/assistant'

/** Cap the persisted history so localStorage stays small. */
const MAX_MESSAGES = 60
const MAX_LOG = 50

interface ActionLogEntry {
  date: string
  action: string
  params: Record<string, any>
  opHash?: string
}

interface AssistantState {
  settings: AssistantSettings
  messages: ChatMessage[]
  /** Memory of what the user used the assistant for */
  actionLog: ActionLogEntry[]

  // transient
  isOpen: boolean
  isLoading: boolean
  error?: string
  pendingAction?: AssistantAction

  toggle: () => void
  setSettings: (settings: Partial<AssistantSettings>) => void
  sendMessage: (content: string, attachment?: ChatAttachment) => Promise<void>
  dismissAction: () => void
  logAction: (action: string, params: Record<string, any>, opHash?: string) => void
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
        messages: [],
        actionLog: [],

        isOpen: false,
        isLoading: false,
        error: undefined,
        pendingAction: undefined,

        toggle: () => set({ isOpen: !get().isOpen }),

        setSettings: (settings) =>
          set({ settings: { ...get().settings, ...settings } }),

        sendMessage: async (content, attachment) => {
          const { settings, messages } = get()
          const text = attachment
            ? `${content}\n[attached file: ${attachment.name} (${attachment.mimeType})]`.trim()
            : content
          const next = [
            ...messages,
            { role: 'user' as const, content: text },
          ].slice(-MAX_MESSAGES)
          set({
            messages: next,
            isLoading: true,
            error: undefined,
            pendingAction: undefined,
          })
          try {
            const { message, action } = await sendChat(
              settings,
              next,
              attachment
            )
            set({
              messages: [
                ...next,
                {
                  role: 'assistant' as const,
                  content:
                    message ||
                    (action ? 'Here is what I prepared — please review.' : '…'),
                },
              ].slice(-MAX_MESSAGES),
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

        clearChat: () =>
          set({ messages: [], pendingAction: undefined, error: undefined }),
      }),
      {
        name: 'assistant',
        storage: createJSONStorage(() => localStorage),
        version: 1,
        partialize: (state) => ({
          settings: state.settings,
          messages: state.messages,
          actionLog: state.actionLog,
        }),
      }
    )
  )
)
