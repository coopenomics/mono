/** Таблицы расширения в базе кооператива: по ним собираются типы запросов (`pnpm schema:types`). */
export default [
  'chatcoop_calendar_events',
  'chatcoop_calendar_ics_subscriptions',
  'chatcoop_call_transcriptions',
  'chatcoop_managed_matrix_rooms',
  'chatcoop_room_message_history',
  'chatcoop_state',
  'chatcoop_transcription_segments',
  'matrix_users',
  'union_chats',
] as const;
