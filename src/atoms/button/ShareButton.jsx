import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@atoms/button'
import { HashToURL } from '@utils'
import { getTokenPreviewUrl } from '@utils/token'
import ShareModal from '@atoms/modal/ShareModal'

export default function ShareButton({
  url,
  title,
  displayUri,
  artistName,
  tokenId,
  artistAddress,
  mimeType,
  artifactUri,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const handleShareOnBlog = tokenId
    ? () => {
        const tokenName = title || `Token #${tokenId}`
        const artistAddr = artistAddress || ''
        const previewUrl = getTokenPreviewUrl({
          mime_type: mimeType,
          artifact_uri: artifactUri,
          display_uri: displayUri,
        })

        const comment = `<!-- teia-token:${JSON.stringify({
          token_id: String(tokenId),
          artist_address: artistAddr,
          artist_name: artistName,
          mime_type: mimeType || '',
          royalties: { decimals: 4, shares: { [artistAddr]: 1500 } },
        })} -->`

        const imageLink = previewUrl
          ? `[![${tokenName} by ${artistName}](${previewUrl})](https://teia.art/objkt/${tokenId})`
          : `[${tokenName}](https://teia.art/objkt/${tokenId})`

        const audioLine =
          mimeType?.startsWith('audio/') && artifactUri
            ? `\n![Audio](${HashToURL(artifactUri)})`
            : ''

        const attribution = `*[${tokenName}](https://teia.art/objkt/${tokenId}) by [${artistName}](https://teia.art/${artistAddr})*`

        const embedContent = `\n${comment}\n${imageLink}${audioLine}\n${attribution}\n`

        navigate('/blog/newpost', { state: { embedContent } })
      }
    : null

  return (
    <>
      <Button onClick={() => setIsOpen(true)} full shadow_box>
        Share
      </Button>
      <ShareModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        url={url}
        title={title}
        displayUri={displayUri}
        artistName={artistName}
        onShareOnBlog={handleShareOnBlog}
      />
    </>
  )
}
