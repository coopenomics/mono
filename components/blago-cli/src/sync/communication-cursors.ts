// Курсоры инкрементальной синхронизации переписки (аналог PG у GitHub-секретаря).

import * as fs from 'node:fs/promises'

import { blagoDir, communicationCursorsPath } from '../config/paths.js'

export interface CommunicationCursorsFile {
  /** matrixRoomId → последний обработанный origin_server_ts (мс) */
  messageLastTsByRoom: Record<string, number>
  /** project_hash → ISO instant: транскрипции с endedAt ≤ этого момента уже выгружены */
  transcriptionLastEndedExclusiveByProject: Record<string, string>
  /** matrixRoomId → ISO instant: транскрипции непроектной комнаты с endedAt ≤ этого момента уже выгружены */
  transcriptionLastEndedExclusiveByRoom: Record<string, string>
}

function empty(): CommunicationCursorsFile {
  return {
    messageLastTsByRoom: {},
    transcriptionLastEndedExclusiveByProject: {},
    transcriptionLastEndedExclusiveByRoom: {},
  }
}

export async function loadCommunicationCursors(root: string): Promise<CommunicationCursorsFile> {
  try {
    const raw = await fs.readFile(communicationCursorsPath(root), 'utf8')
    const parsed = JSON.parse(raw) as Partial<CommunicationCursorsFile>
    return {
      messageLastTsByRoom:
        parsed.messageLastTsByRoom !== undefined && typeof parsed.messageLastTsByRoom === 'object'
          ? { ...parsed.messageLastTsByRoom }
          : {},
      transcriptionLastEndedExclusiveByProject:
        parsed.transcriptionLastEndedExclusiveByProject !== undefined
        && typeof parsed.transcriptionLastEndedExclusiveByProject === 'object'
          ? { ...parsed.transcriptionLastEndedExclusiveByProject }
          : {},
      transcriptionLastEndedExclusiveByRoom:
        parsed.transcriptionLastEndedExclusiveByRoom !== undefined
        && typeof parsed.transcriptionLastEndedExclusiveByRoom === 'object'
          ? { ...parsed.transcriptionLastEndedExclusiveByRoom }
          : {},
    }
  }
  catch {
    return empty()
  }
}

export async function saveCommunicationCursors(root: string, data: CommunicationCursorsFile): Promise<void> {
  await fs.mkdir(blagoDir(root), { recursive: true })
  await fs.writeFile(communicationCursorsPath(root), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}
