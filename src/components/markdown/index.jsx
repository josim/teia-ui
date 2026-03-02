import MarkdownPreview from '@uiw/react-markdown-preview/nohighlight'
import '@uiw/react-markdown-preview/markdown.css'
import styles from '@style'

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|aac|m4a|opus|webm)(\?|$)/i

const components = {
  a: ({ children, href, ...props }) => (
    <a href={href} target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  ),
  img: ({ alt, src, ...props }) => {
    if (alt === 'Audio' || AUDIO_EXTENSIONS.test(src)) {
      return (
        <audio
          controls
          src={src}
          style={{ width: '100%', display: 'block', minHeight: '54px' }}
        />
      )
    }
    return <img alt={alt} src={src} {...props} />
  },
  hr: ({ ...props }) => <hr className={styles.spacer} {...props} />,
}

export const Markdown = ({ children, className }) => {
  return (
    <MarkdownPreview
      source={children}
      className={`${className || ''} ${styles.content}`}
      components={components}
      disableCopy
    />
  )
}
