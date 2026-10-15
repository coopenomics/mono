/**
 * Matrix: комната совета кооператива.
 * В комнату попадают только члены совета; звонки (Element Call / MSC3401 / legacy m.call) доступны всем с power level 0.
 */

import type { MatrixChatRoomPreset } from './matrix-chat-room-preset.types';
import { t } from '../../i18n';

function buildPowerLevels(adminUserId: string): Record<string, unknown> {
  return {
    users_default: 0,
    invite: 100,
    kick: 100,
    ban: 100,
    redact: 50,
    state_default: 100,
    events_default: 0,
    users: {
      [adminUserId]: 100,
    },
    events: {
      'm.room.name': 100,
      'm.room.topic': 100,
      'm.room.power_levels': 100,
      'm.room.history_visibility': 100,
      'm.room.encryption': 100,

      'io.element.call': 0,
      'io.element.call.member': 0,

      'org.matrix.msc3401.call': 0,
      'org.matrix.msc3401.call.member': 0,

      'm.call': 0,
      'm.call.invite': 0,
      'm.call.answer': 0,
      'm.call.hangup': 0,
      'm.call.candidates': 0,
      'm.call.select_answer': 0,
      'm.call.reject': 0,
      'm.call.negotiate': 0,
    },
  };
}

export const COUNCIL_ROOM_MATRIX: MatrixChatRoomPreset = {
  label: t('chatcoop.room.status.councilFull'),
  isPrivate: true,
  encrypt: true,
  roomType: undefined,
  initialState: [],
  buildPowerLevels,
};
