import { createReactInlineContentSpec } from '@blocknote/react'
import { searchUsersByName } from '@data/api'
import { walletPreview } from '@utils/string'
import styles from '../index.module.scss'

export const MentionInline = createReactInlineContentSpec(
  {
    type: 'teiaMention',
    propSchema: {
      address: { default: '' },
      name: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { address, name } = props.inlineContent.props
      return (
        <a
          href={`/tz/${address}`}
          className={styles.mention_inline}
          data-mention={address}
        >
          @{name || walletPreview(address)}
        </a>
      )
    },
  }
)

export async function getMentionItems(editor, query) {
  if (!query || query.length < 2) return []

  let users
  try {
    users = await searchUsersByName(query)
  } catch {
    return []
  }

  return users.slice(0, 8).map((user) => ({
    title: user.name || walletPreview(user.user_address),
    subtext: walletPreview(user.user_address),
    onItemClick: () => {
      editor.insertInlineContent([
        {
          type: 'teiaMention',
          props: {
            address: user.user_address,
            name: user.name || '',
          },
        },
        ' ',
      ])
    },
  }))
}
