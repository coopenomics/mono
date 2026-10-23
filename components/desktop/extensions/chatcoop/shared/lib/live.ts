import type { ChainTableRef } from 'src/shared/lib/realtime'

/** Код расширения «Чат кооператива» в ленте изменений. */
const CODE = 'chatcoop'

/** Учётная запись пайщика в Matrix: создана, заблокирована, пересоздана. */
export const CHAT_ACCOUNT_LIVE_TABLES: ChainTableRef[] = [{ code: CODE, table: 'matrix_users' }]

/** Комнаты, которыми управляет кооператив (секретарь, календарь). */
export const CHAT_ROOMS_LIVE_TABLES: ChainTableRef[] = [{ code: CODE, table: 'chatcoop_managed_matrix_rooms' }]

/** Календарь кооператива: события и комнаты, к которым они привязаны. */
export const CHAT_CALENDAR_LIVE_TABLES: ChainTableRef[] = [
  { code: CODE, table: 'chatcoop_calendar_events' },
  ...CHAT_ROOMS_LIVE_TABLES,
]

/** Транскрипции звонков: сигнал получают участники звонка и совет. */
export const CHAT_TRANSCRIPTIONS_LIVE_TABLES: ChainTableRef[] = [{ code: CODE, table: 'chatcoop_call_transcriptions' }]
