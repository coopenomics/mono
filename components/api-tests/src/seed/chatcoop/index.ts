/**
 * Засев стенда для документации кооперативного мессенджера (docs-harness,
 * сюита run-chatcoop-all). Сервер Matrix на стенде подставной: комнаты
 * реестра и записи звонков засев кладёт в базу, как это делает внешний слой.
 *
 *   01-install    — председатель установил приложение «Кооперативный мессенджер».
 *   02-rooms      — в реестре комнаты совета, пайщиков и секретаря.
 *   03-calendar   — в календаре события собрания совета и общего собрания.
 *   04-transcript — запись звонка совета с репликами.
 *
 *   esno src/seed/chatcoop/index.ts 01-install
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { tokenOf } from '../../core/auth'
import { gql } from '../../core/client'
import { REPO_ROOT } from '../../core/env'
import { CHAIRMAN, COUNCIL } from '../../core/roles'
import { seedRoom, seedSql, seedTranscription } from '../../capital/cap-access.helpers'

const log = (...a: unknown[]) => console.error('[seed-chatcoop]', ...a)

const EXTENSION = 'chatcoop'
const STATE = path.join(REPO_ROOT, 'components/docs-harness/state/seed-chatcoop.json')
const CATALOG = 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name is_installed enabled config } }'
const INSTALL = 'mutation($d:ExtensionInput!){ installExtension(data:$d){ name is_installed } }'
const UPDATE = 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }'
const EVENTS = 'query{ chatcoopListCalendarEvents{ id title } }'
const CREATE_EVENT = 'mutation($d:CreateChatCoopCalendarEventInput!){ chatcoopCreateCalendarEvent(data:$d){ id } }'

interface State { council?: string, members?: string, secretary?: string, transcript?: string }

function readState(): State {
  return fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {}
}

function writeState(s: State): void {
  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2))
}

function lit(v: string): string {
  return `'${v.replace(/'/g, '\'\'')}'`
}

/** 01 — приложение установлено и включено. */
async function phase01(): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const ext = ((await gql<any>(chairman, CATALOG, { d: {} })).getExtensions as any[]).find(e => e.name === EXTENSION)
  if (!ext)
    throw new Error('мессенджера нет в каталоге приложений стенда')
  if (!ext.is_installed) {
    await gql(chairman, INSTALL, { d: { name: EXTENSION, enabled: true, config: { messageHistorySyncIntervalMinutes: 2 } } })
    log('приложение «Кооперативный мессенджер» установлено')
  }
  else if (!ext.enabled) {
    await gql(chairman, UPDATE, { d: { name: EXTENSION, enabled: true, config: ext.config ?? {} } })
    log('приложение «Кооперативный мессенджер» включено')
  }
  else {
    log('приложение «Кооперативный мессенджер» уже работает')
  }
}

/** 02 — комнаты совета, пайщиков и секретаря в реестре. */
async function phase02(): Promise<void> {
  const s = readState()
  if (s.council) {
    log('комнаты уже в реестре')
    return
  }
  s.council = seedRoom('council', null, 'Совет кооператива')
  s.members = seedRoom('members', null, 'Пайщики кооператива')
  s.secretary = seedRoom('secretary', null, 'Секретарь собраний')
  writeState(s)
  log('в реестре комнаты совета, пайщиков и секретаря')
}

/** 03 — события календаря. */
async function phase03(): Promise<void> {
  const s = readState()
  if (!s.council || !s.members)
    throw new Error('комнат нет: сначала фаза 02-rooms')
  const council = await tokenOf(COUNCIL)
  const have = ((await gql<any>(council, EVENTS)).chatcoopListCalendarEvents as any[]).map(e => e.title)
  const day = (n: number, h: number): string => {
    const d = new Date(Date.now() + n * 86400_000)
    d.setUTCHours(h, 0, 0, 0)
    return d.toISOString()
  }
  const events = [
    { matrixRoomId: s.council, title: 'Заседание совета', description: 'Повестка: служебные записки на расход, приём пайщиков', startsAt: day(2, 15), endsAt: day(2, 16) },
    { matrixRoomId: s.members, title: 'Общее собрание пайщиков', description: 'Отчёт совета за квартал, утверждение сметы', startsAt: day(6, 14), endsAt: day(6, 16) },
  ].filter(e => !have.includes(e.title))
  for (const e of events)
    await gql(council, CREATE_EVENT, { d: e })
  log(`в календаре событий: ${have.length + events.length}`)
}

/** 04 — запись звонка совета с репликами. */
async function phase04(): Promise<void> {
  const s = readState()
  if (!s.council)
    throw new Error('комнат нет: сначала фаза 02-rooms')
  if (s.transcript) {
    log('запись звонка уже есть')
    return
  }
  const id = seedTranscription(s.council, 'Коллеги, на повестке две служебные записки на расход.')
  const lines: [string, string][] = [
    ['Пётр Сидоров', 'Первая — аренда зала к общему собранию, шесть тысяч рублей по счёту.'],
    ['Анна Петрова', 'Счёт проверила, реквизиты верные. Предлагаю голосовать «за».'],
    ['Председатель', 'Принято. Вторую записку переносим на следующее заседание.'],
  ]
  lines.forEach(([name, text], i) => {
    seedSql(`INSERT INTO chatcoop_transcription_segments (transcription_id, speaker_identity, speaker_name, text, start_offset, end_offset)
      VALUES (${lit(id)}, ${lit(`@speaker${i}:blackbox.test`)}, ${lit(name)}, ${lit(text)}, ${2 + i * 6}, ${7 + i * 6})`)
  })
  seedSql(`UPDATE chatcoop_call_transcriptions SET room_name = 'Заседание совета' WHERE id = ${lit(id)}`)
  s.transcript = id
  writeState(s)
  log('запись звонка совета с репликами')
}

const PHASES: Record<string, () => Promise<void>> = {
  '01-install': phase01,
  '02-rooms': phase02,
  '03-calendar': phase03,
  '04-transcript': phase04,
}

async function main(): Promise<void> {
  for (const name of process.argv.slice(2)) {
    const fn = PHASES[name]
    if (!fn) {
      console.error(`неизвестная фаза ${name}; есть: ${Object.keys(PHASES).join(', ')}`)
      process.exit(2)
    }
    console.error(`\n=== seed-chatcoop: ${name} ===`)
    await fn()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
