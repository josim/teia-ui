import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CurationDraftStore {
  drafts: Record<string, unknown>
  setDraft: (key: string, values: unknown) => void
  clearDraft: (key: string) => void
}

export const useCurationDraftStore = create<CurationDraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (key, values) =>
        set((s) => ({ drafts: { ...s.drafts, [key]: values } })),
      clearDraft: (key) =>
        set((s) => {
          if (!(key in s.drafts)) return s
          const drafts = { ...s.drafts }
          delete drafts[key]
          return { drafts }
        }),
    }),
    {
      name: 'teia-curation-drafts',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
