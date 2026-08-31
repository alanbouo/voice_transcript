/**
 * Timestamp helpers for transcripts.
 *
 * AssemblyAI reports utterance boundaries in milliseconds. These mirror
 * utils/transcript_format.py on the backend so the API, the exports and the
 * viewer all show the same format.
 */

/** Format a millisecond offset as MM:SS (or H:MM:SS past one hour). */
export const formatTimestamp = (milliseconds) => {
  if (milliseconds === null || milliseconds === undefined) return ''

  const value = Number(milliseconds)
  if (!Number.isFinite(value)) return ''

  const totalSeconds = Math.floor(Math.max(0, value) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const paddedSeconds = String(seconds).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
  }
  return `${String(minutes).padStart(2, '0')}:${paddedSeconds}`
}

/** Format an utterance span as "MM:SS - MM:SS" (or just the start). */
export const formatRange = (start, end) => {
  const startLabel = formatTimestamp(start)
  const endLabel = formatTimestamp(end)

  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`
  return startLabel || endLabel
}

/**
 * Build the plain-text version of a transcript, optionally prefixed with
 * timestamps - used for "Copy transcript".
 */
export const renderTranscriptText = (utterances, getSpeakerName, includeTimestamps = true) => {
  return (utterances || [])
    .map((utterance) => {
      const speaker = getSpeakerName ? getSpeakerName(utterance.speaker) : utterance.speaker
      const prefix = speaker ? `${speaker}: ` : ''
      const stamp = includeTimestamps ? formatTimestamp(utterance.start) : ''
      return stamp ? `[${stamp}] ${prefix}${utterance.text}` : `${prefix}${utterance.text}`
    })
    .join('\n\n')
}
