/**
 * Matrix: комната проекта Capital (чат по проекту в space кооператива).
 * Отдельно от комнаты пайщиков — можно менять права и параметры создания независимо.
 */

import type { MatrixChatRoomPreset } from './matrix-chat-room-preset.types';
import { t } from '../../i18n';

/**
 * Те же принципы, что у комнаты пайщиков: модераторы (50) почти по всем настройкам комнаты;
 * 100 только у Matrix-админа для критичных state (power_levels, encryption, tombstone, ACL).
 */
function buildPowerLevels(adminUserId: string): Record<string, unknown> {
  return {
    users_default: 0,
    invite: 50,
    kick: 50,
    ban: 50,
    redact: 50,
    state_default: 50,
    events_default: 0,
    users: {
      [adminUserId]: 100,
    },
    events: {
      'm.room.name': 50,
      'm.room.topic': 50,
      'm.room.avatar': 50,
      'm.room.pinned_events': 50,
      'm.room.canonical_alias': 50,
      'm.room.aliases': 50,
      'm.room.power_levels': 100,
      'm.room.history_visibility': 50,
      'm.room.encryption': 100,
      'm.room.tombstone': 100,
      'm.room.server_acl': 100,

      'im.vector.modular.widgets': 50,
      'm.widget': 50,
      'org.matrix.msc2876.widgets': 50,
      'io.element.widgets.layout': 50,

      'io.element.call': 50,
      'io.element.call.member': 0,
      'org.matrix.msc3401.call': 50,
      'org.matrix.msc3401.call.member': 0,
      'm.call': 50,
      'm.call.invite': 50,
      'm.call.answer': 0,
      'm.call.hangup': 0,
      'm.call.candidates': 0,
      'm.call.select_answer': 0,
      'm.call.reject': 0,
      'm.call.negotiate': 0,
    },
  };
}

export const CAPITAL_PROJECT_ROOM_MATRIX: MatrixChatRoomPreset = {
  label: t('chatcoop.room.status.capitalProject'),
  isPrivate: true,
  encrypt: false,
  roomType: undefined,
  initialState: [],
  buildPowerLevels,
};
