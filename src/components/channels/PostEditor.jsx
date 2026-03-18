import { useCallback, useMemo } from 'react'
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from '@blocknote/core'
import '@blocknote/ariakit/style.css'
import { useLocalSettings } from '@context/localSettingsStore'
import { Button } from '@atoms/button'
import { TokenEmbedBlock } from './blocks/TokenEmbedBlock'
import { MediaUploadBlock } from './blocks/MediaUploadBlock'
import { MentionInline, getMentionItems } from './blocks/MentionBlock'
import styles from '@style'

const DARK_THEMES = new Set(['dark', 'midnight', 'coffee'])
const MAX_POST_SIZE = 512 * 1024 // 512KB

export const postEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    teiaToken: TokenEmbedBlock(),
    teiaMedia: MediaUploadBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    teiaMention: MentionInline,
  },
})

export default function PostEditor({ onSubmit, onCancel }) {
  const theme = useLocalSettings((s) => s.theme)
  const bnTheme = DARK_THEMES.has(theme) ? 'dark' : 'light'

  const editor = useCreateBlockNote({ schema: postEditorSchema })

  const getSlashMenuItems = useMemo(
    () => async (query) => {
      const defaults = getDefaultReactSlashMenuItems(editor)
      const custom = [
        {
          title: 'Teia Token',
          subtext: 'Embed a Teia NFT',
          aliases: ['token', 'nft', 'objkt', 'embed'],
          group: 'Teia',
          onItemClick: () => {
            editor.insertBlocks(
              [{ type: 'teiaToken' }],
              editor.getTextCursorPosition().block,
              'after'
            )
          },
        },
        {
          title: 'Media Upload',
          subtext: 'Upload image, audio, or video to IPFS',
          aliases: ['image', 'upload', 'audio', 'video', 'media'],
          group: 'Teia',
          onItemClick: () => {
            editor.insertBlocks(
              [{ type: 'teiaMedia' }],
              editor.getTextCursorPosition().block,
              'after'
            )
          },
        },
      ]
      const all = [...defaults, ...custom]
      if (!query) return all
      const q = query.toLowerCase()
      return all.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtext?.toLowerCase().includes(q) ||
          item.aliases?.some((a) => a.toLowerCase().includes(q)) ||
          item.group?.toLowerCase().includes(q)
      )
    },
    [editor]
  )

  const handleSubmit = useCallback(() => {
    const doc = editor.document
    const json = JSON.stringify(doc)
    if (json.length > MAX_POST_SIZE) {
      alert('Post is too large (max 512KB)')
      return
    }

    const embeddedTokens = doc
      .filter((b) => b.type === 'teiaToken' && b.props?.tokenId)
      .map((b) => ({ token_id: b.props.tokenId, fa2: b.props.fa2 }))

    onSubmit({ content: doc, embeddedTokens })
  }, [editor, onSubmit])

  return (
    <div className={styles.post_editor_wrapper}>
      <BlockNoteView editor={editor} theme={bnTheme} slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashMenuItems}
        />
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={(query) => getMentionItems(editor, query)}
        />
      </BlockNoteView>
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
