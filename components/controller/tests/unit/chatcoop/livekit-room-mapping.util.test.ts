/**
 * Unit-тесты сопоставления LiveKit room name ↔ Matrix room ID.
 *
 * Регрессия 2026-06-07: публичный Element Call (call.element.io) обновился и перешёл
 * на слот-протокол MatrixRTC. Имя LiveKit-комнаты теперь считает lk-jwt-service как
 * `unpaddedBase64(sha256(JSON.stringify([roomId, "m.call#ROOM"])))`, а не старое
 * `unpaddedBase64(sha256(roomId + "|m.call#ROOM"))`. Старая формула в coopback перестала
 * матчить webhook'и → секретарь молча игнорировал все звонки.
 *
 * Живая пара ниже снята с прода (комната «Ферма на Паях», созвон 07.06 11:00).
 */
import {
  matrixRoomIdToLivekitRoomName,
  matrixRoomIdToLivekitRoomNameLegacy,
  findMatrixRoomIdForLivekitRoom,
} from '../../../src/extensions/chatcoop/application/utils/livekit-room-mapping.util';

const ROOM_ID = '!ERaEcYxtNeyTVOIWdh:chat.coopenomics.world';
const CURRENT_ALIAS = '4GLR01IGSn3tkphiHRrZO8zE0tgcoZv+rFGP77HOZCQ';
const LEGACY_ALIAS = '62X+yyaaJv139B95dTxP7NhmUhdanIp3HieJ/PSu0E0';

describe('livekit-room-mapping', () => {
  it('текущий алгоритм Element Call даёт alias из lk-jwt-service (JSON-массив)', () => {
    expect(matrixRoomIdToLivekitRoomName(ROOM_ID)).toBe(CURRENT_ALIAS);
  });

  it('legacy-алгоритм даёт старый alias (склейка через |)', () => {
    expect(matrixRoomIdToLivekitRoomNameLegacy(ROOM_ID)).toBe(LEGACY_ALIAS);
  });

  it('матчит комнату по текущему формату', () => {
    expect(findMatrixRoomIdForLivekitRoom(CURRENT_ALIAS, [ROOM_ID])).toBe(ROOM_ID);
  });

  it('матчит комнату и по legacy-формату (старые клиенты Element)', () => {
    expect(findMatrixRoomIdForLivekitRoom(LEGACY_ALIAS, [ROOM_ID])).toBe(ROOM_ID);
  });

  it('возвращает null для чужого имени', () => {
    expect(findMatrixRoomIdForLivekitRoom('totally-unrelated', [ROOM_ID])).toBeNull();
  });
});
