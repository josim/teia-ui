import { memo } from 'react'
import styles from '@style'

function renderInlineContent(content) {
  if (!content || !Array.isArray(content)) return null
  return content.map((item, i) => {
    if (item.type === 'text') {
      let node = item.text
      const s = item.styles || {}
      if (s.bold) node = <strong key={i}>{node}</strong>
      if (s.italic) node = <em key={`i${i}`}>{node}</em>
      if (s.underline) node = <u key={`u${i}`}>{node}</u>
      if (s.strikethrough) node = <s key={`s${i}`}>{node}</s>
      if (s.code) node = <code key={`c${i}`}>{node}</code>
      return <span key={i}>{node}</span>
    }
    if (item.type === 'link') {
      return (
        <a key={i} href={item.href} target="_blank" rel="noopener noreferrer">
          {renderInlineContent(item.content)}
        </a>
      )
    }
    // Stub for future custom inline types (teiaMention, etc.)
    return <span key={i}>{item.text || ''}</span>
  })
}

function renderBlock(block, index) {
  const content = renderInlineContent(block.content)

  switch (block.type) {
    case 'paragraph':
      return <p key={block.id || index}>{content}</p>
    case 'heading': {
      const level = block.props?.level || 2
      const Tag = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
      return <Tag key={block.id || index}>{content}</Tag>
    }
    case 'bulletListItem':
      return <li key={block.id || index}>{content}</li>
    case 'numberedListItem':
      return <li key={block.id || index}>{content}</li>
    case 'codeBlock':
      return (
        <pre key={block.id || index}>
          <code>{block.content?.[0]?.text || ''}</code>
        </pre>
      )
    case 'image':
      return (
        <img
          key={block.id || index}
          src={block.props?.url}
          alt={block.props?.caption || ''}
          style={{ maxWidth: '100%' }}
        />
      )
    // Stubs for future custom block types
    case 'teiaToken':
    case 'teiaMedia':
      return <div key={block.id || index}>[Embedded content]</div>
    default:
      return content ? <p key={block.id || index}>{content}</p> : null
  }
}

function groupListItems(blocks) {
  const result = []
  let currentList = null

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type === 'bulletListItem') {
      if (!currentList || currentList.tag !== 'ul') {
        currentList = { tag: 'ul', items: [] }
        result.push(currentList)
      }
      currentList.items.push(block)
    } else if (block.type === 'numberedListItem') {
      if (!currentList || currentList.tag !== 'ol') {
        currentList = { tag: 'ol', items: [] }
        result.push(currentList)
      }
      currentList.items.push(block)
    } else {
      currentList = null
      result.push(block)
    }
  }

  return result
}

function PostDisplay({ blocks }) {
  if (!blocks || !Array.isArray(blocks)) return null

  const grouped = groupListItems(blocks)

  return (
    <div className={styles.post_display}>
      {grouped.map((item, i) => {
        if (item.tag) {
          const Tag = item.tag
          return (
            <Tag key={i}>
              {item.items.map((block, j) => renderBlock(block, j))}
            </Tag>
          )
        }
        return renderBlock(item, i)
      })}
    </div>
  )
}

export default memo(PostDisplay)
