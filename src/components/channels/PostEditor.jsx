import { useCallback } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import '@blocknote/ariakit/style.css'
import { useLocalSettings } from '@context/localSettingsStore'
import { Button } from '@atoms/button'
import styles from '@style'

const DARK_THEMES = new Set(['dark', 'midnight', 'coffee'])
const MAX_POST_SIZE = 512 * 1024 // 512KB

export default function PostEditor({ onSubmit, onCancel }) {
  const theme = useLocalSettings((s) => s.theme)
  const bnTheme = DARK_THEMES.has(theme) ? 'dark' : 'light'

  const editor = useCreateBlockNote()

  const handleSubmit = useCallback(() => {
    const doc = editor.document
    const json = JSON.stringify(doc)
    if (json.length > MAX_POST_SIZE) {
      alert('Post is too large (max 512KB)')
      return
    }
    onSubmit({ content: doc, embeddedTokens: [] })
  }, [editor, onSubmit])

  return (
    <div className={styles.post_editor_wrapper}>
      <BlockNoteView editor={editor} theme={bnTheme} />
      <div className={styles.post_actions}>
        <Button shadow_box onClick={onCancel}>
          Cancel
        </Button>
        <Button shadow_box onClick={handleSubmit}>
          Publish Post
        </Button>
      </div>
    </div>
  )
}
