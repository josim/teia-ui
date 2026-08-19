import { curationIpfsUrl } from '@data/curations'

/**
 * Curation cover image. May be replaced later.
 */
export default function CurationCover({ uri, className, style, alt, onError }) {
  return (
    <img
      className={className}
      style={style}
      src={curationIpfsUrl(uri)}
      alt={alt}
      onError={onError}
    />
  )
}
