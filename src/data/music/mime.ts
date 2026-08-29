// Playable-media detection
// HTMLMediaElement can't decode midi.

export const PLAYABLE_MIME = [
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/vorbis',
  'video/mp4',
] as const

export function isPlayable(token: { mime_type?: string | null }): boolean {
  const m = token?.mime_type
  if (!m) return false
  if (m === 'audio/midi' || m === 'audio/mid') return false
  return m.startsWith('audio/') || m === 'video/mp4'
}
