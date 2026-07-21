import {
  ALLOWED_COVER_MIMETYPES,
  ALLOWED_FILETYPES_LABEL,
  ALLOWED_MIMETYPES,
  AUTO_GENERATE_COVER_MIMETYPES,
  LANGUAGES_OPTIONS,
  LICENSE_TYPES_OPTIONS,
  MAX_EDITIONS,
  MAX_ROYALTIES,
  MIN_ROYALTIES,
} from '@constants'
import { useMintStore } from '@context/mintStore'
import { useUserStore } from '@context/userStore'
import { fetchObjktDetails } from '@data/api'
import { convertFileToFileForm } from '@utils/mint'
import { processTypedInput } from '@utils/typed-art'
import { processMidiCover } from '@utils/midi'

export const matchLicense = (value?: string) =>
  value ? LICENSE_TYPES_OPTIONS.find((o) => o.value === value) : undefined

export const matchLanguage = (value?: string) =>
  value
    ? LANGUAGES_OPTIONS.find((o) => o.value === String(value).toLowerCase())
    : undefined

export const validateMintParams = (params: Record<string, any>) => {
  const editions = parseInt(params.editions)
  const royalties = parseInt(params.royalties)
  if (isNaN(editions) || editions < 1 || editions > MAX_EDITIONS)
    return `Editions must be between 1 and ${MAX_EDITIONS}`
  if (isNaN(royalties) || royalties < MIN_ROYALTIES || royalties > MAX_ROYALTIES)
    return `Royalties must be between ${MIN_ROYALTIES}% and ${MAX_ROYALTIES}%`
  if (params.title && params.title.length > 500)
    return 'Title must be 500 characters or less'
  if (params.description && params.description.length > 5000)
    return 'Description must be 5000 characters or less'
  if (params.text_mint && !params.text_content?.trim())
    return 'A text mint needs its text content'
  return null
}

/** Whether this artifact mimetype requires a user-provided cover image */
export const artifactNeedsCover = (mimeType: string) =>
  !mimeType.startsWith('image') &&
  !AUTO_GENERATE_COVER_MIMETYPES.includes(mimeType)

/** Map validated prepare_mint params to the mint store field shape */
export const buildMintFields = (params: Record<string, any>) => ({
  title: params.title || '',
  description: params.description || '',
  tags: params.tags || '',
  editions: parseInt(params.editions),
  royalties: parseInt(params.royalties),
  nsfw: Boolean(params.nsfw),
  photosensitive: Boolean(params.photosensitive),
  license: matchLicense(params.license),
  language: matchLanguage(params.language),
  isTyped: Boolean(params.text_mint),
  typedinput: params.text_mint ? params.text_content : '',
  isMonoType: Boolean(params.text_mint && params.monospace),
})

/**
 * Running the full mint pipeline from the assistant page: convert the attached
 * file(s) exactly like MintForm does, stage the store, and call mint().
 * Returns an error string to show inline, or null when the flow ran.
 */
export async function executeAgentMint(
  params: Record<string, any>,
  artifactFile: File | null,
  coverFile: File | null,
  ignoreUriMap: Map<string, number>
): Promise<string | null> {
  const invalid = validateMintParams(params)
  if (invalid) return invalid

  const fields = buildMintFields(params)

  if (params.text_mint) {
    const data = await processTypedInput({ ...fields } as any)
    useMintStore.setState({ ...data, isValid: true })
  } else {
    if (!artifactFile) return 'Attach your artwork file first'
    const artifact = await convertFileToFileForm(artifactFile)
    if (!ALLOWED_MIMETYPES.includes(artifact.mimeType))
      return `Unsupported file type. Supported: ${ALLOWED_FILETYPES_LABEL.toLocaleLowerCase()}`

    if (['audio/midi', 'audio/mid'].includes(artifact.mimeType)) {
      const data = await processMidiCover({ ...fields, artifact } as any)
      useMintStore.setState({ ...data, isValid: true })
    } else {
      if (!AUTO_GENERATE_COVER_MIMETYPES.includes(artifact.mimeType)) {
        artifact.reader = URL.createObjectURL(artifactFile)
      }
      let cover
      if (artifactNeedsCover(artifact.mimeType)) {
        if (!coverFile)
          return 'This file type needs a cover image — attach one (jpeg, png or gif)'
        cover = await convertFileToFileForm(coverFile)
        if (!ALLOWED_COVER_MIMETYPES.includes(cover.mimeType))
          return 'The cover must be a jpeg, png or gif image'
      }
      useMintStore.setState({
        ...fields,
        artifact,
        cover,
        thumbnail: undefined,
        isValid: true,
      })
    }
  }

  await (useMintStore.getState() as any).mint(ignoreUriMap)
  return null
}

/**
 * Execute a confirmed listing. Returns an inline error string, or the
 * operation hash on success (undefined when the wallet flow was aborted).
 */
export async function executeAgentSwap(
  params: Record<string, any>
): Promise<{ error?: string; opHash?: string }> {
  const { address, swap, sync } = useUserStore.getState()
  if (!address) {
    await sync()
    return { error: 'Wallet sync required — confirm again once synced' }
  }
  const nft = await fetchObjktDetails(String(params.objkt_id))
  if (!nft) return { error: `OBJKT #${params.objkt_id} not found` }
  const opHash = await swap(
    address,
    nft.royalties_total / 1000,
    Number((parseFloat(params.price) * 1e6).toFixed(0)) as any,
    String(params.objkt_id),
    nft.artist_address,
    parseInt(params.amount)
  )
  return { opHash: opHash || undefined }
}
