// Разметка как у FileFormatService.projectCommunicationChat / render transcription (Capital GitHub-синк).

export interface CommunicationDayLine {
  readonly originServerTs: number
  readonly authorLabel: string
  readonly coopUsername: string | null | undefined
  /** GraphQL RoomMessageKind: TEXT | AUDIO */
  readonly kind: string
  readonly bodyText: string
}

/** Один файл `messages/UTC-date.md` — как `projectCommunicationDayToMarkdown` на контроллере. */
export function projectCommunicationDayToMarkdown(
  projectTitle: string,
  projectHash: string,
  utcDate: string,
  sections: { displayLabel: string, matrixRoomId: string, lines: CommunicationDayLine[] }[],
): string {
  const header = [`# ${utcDate}`, ``, projectTitle, ``, `- Проект: \`${projectHash}\``, ``, `## Сообщения:`, ``]
  const parts: string[] = [...header]
  const nonEmpty = sections.filter(s => s.lines.length > 0)
  const showRoomTitles = nonEmpty.length > 1
  for (const s of nonEmpty) {
    if (showRoomTitles) {
      parts.push(`### ${s.displayLabel}`)
      parts.push(``)
    }
    parts.push(`Matrix room: \`${s.matrixRoomId}\``)
    parts.push(``)
    for (const line of s.lines) {
      const iso = new Date(line.originServerTs).toISOString()
      const tag = line.kind === 'AUDIO' ? '🎤' : '💬'
      const who = line.coopUsername ? `${line.authorLabel} (@${line.coopUsername})` : line.authorLabel
      parts.push(`- **${iso}** ${tag} **${who}**`)
      const indented = line.bodyText.split('\n').join('\n  ')
      parts.push(`  ${indented}`)
      parts.push(``)
    }
    parts.push(`---`)
    parts.push(``)
  }
  return `${parts.join('\n').trim()}\n`
}

export interface TranscriptionHeaderModel {
  roomId: string
  startedAt: Date | string
  endedAt: Date | string | null | undefined
}

export interface TranscriptionSegmentModel {
  speakerName: string
  text: string
  startOffset: number
  endOffset: number
}

export function renderCallTranscriptionMarkdown(
  transcription: TranscriptionHeaderModel,
  segments: TranscriptionSegmentModel[],
): string {
  const sorted = [...segments].sort((a, b) => a.startOffset - b.startOffset)
  const lines = sorted.map((s) => {
    const who = s.speakerName.trim()
    return `**${who}** (${s.startOffset.toFixed(1)}–${s.endOffset.toFixed(1)} s)\n\n${s.text.trim()}`
  })
  const start = transcription.startedAt instanceof Date ? transcription.startedAt : new Date(transcription.startedAt)
  const endRaw = transcription.endedAt
  const end = endRaw === undefined || endRaw === null ? null : (endRaw instanceof Date ? endRaw : new Date(endRaw))
  const header = [
    `# Транскрипция звонка`,
    ``,
    `- LiveKit room: \`${transcription.roomId}\``,
    `- Начало: ${start.toISOString()}`,
    `- Окончание: ${end ? end.toISOString() : '—'}`,
    ``,
  ].join('\n')
  return `${header}\n${lines.join('\n\n---\n\n')}\n`
}

/** Имя файла в `meetings/` без двоеточий; UTC. */
export function transcriptionMeetingFileStemUtc(endedAt: Date): string {
  const y = endedAt.getUTCFullYear()
  const mo = String(endedAt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(endedAt.getUTCDate()).padStart(2, '0')
  const hh = String(endedAt.getUTCHours()).padStart(2, '0')
  const mm = String(endedAt.getUTCMinutes()).padStart(2, '0')
  const ss = String(endedAt.getUTCSeconds()).padStart(2, '0')
  const msl = String(endedAt.getUTCMilliseconds()).padStart(3, '0')
  return `${y}-${mo}-${d}_${hh}${mm}${ss}_${msl}`
}
