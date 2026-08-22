import crypto from 'crypto';

/** Слот звонка по умолчанию в Element Call / MatrixRTC (одна комната = один room-scoped звонок). */
const DEFAULT_CALL_SLOT_ID = 'm.call#ROOM';

function sha256UnpaddedBase64(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest().toString('base64').replace(/=+$/, '');
}

/**
 * Текущий алгоритм Element Call (call.element.io + lk-jwt-service, протокол MatrixRTC со слотами).
 *
 * Клиент шлёт в lk-jwt-service сырой room_id + slot_id="m.call#ROOM", а имя LiveKit-комнаты
 * вычисляет САМ сервис: `unpaddedBase64(sha256(JSON.stringify([roomId, slotId])))`.
 * Источник истины — element-hq/lk-jwt-service.
 */
export function matrixRoomIdToLivekitRoomName(matrixRoomId: string): string {
  return sha256UnpaddedBase64(JSON.stringify([matrixRoomId, DEFAULT_CALL_SLOT_ID]));
}

/**
 * Legacy-алгоритм Element Call (до перехода на слот-протокол MatrixRTC): клиент сам считал
 * имя как `unpaddedBase64(sha256(roomId + "|m.call#ROOM"))` и слал готовым в поле `room`.
 * Оставлен для совместимости со старыми клиентами Element, которые ещё могут слать этот формат.
 */
export function matrixRoomIdToLivekitRoomNameLegacy(matrixRoomId: string): string {
  return sha256UnpaddedBase64(`${matrixRoomId}|${DEFAULT_CALL_SLOT_ID}`);
}

/** Все возможные имена LiveKit-комнаты для данного Matrix room ID (текущий + legacy форматы). */
export function candidateLivekitRoomNames(matrixRoomId: string): string[] {
  return [matrixRoomIdToLivekitRoomName(matrixRoomId), matrixRoomIdToLivekitRoomNameLegacy(matrixRoomId)];
}

/**
 * Находит соответствующий Matrix room ID для данного LiveKit room name.
 * Сверяет и с текущим, и с legacy-алгоритмом — иначе обновление Element Call молча ломает матчинг.
 *
 * @param livekitRoomName LiveKit room name из webhook
 * @param possibleMatrixRoomIds Массив возможных Matrix room IDs для проверки
 * @returns Matrix room ID если найден, иначе null
 */
export function findMatrixRoomIdForLivekitRoom(
  livekitRoomName: string,
  possibleMatrixRoomIds: string[]
): string | null {
  for (const matrixRoomId of possibleMatrixRoomIds) {
    if (candidateLivekitRoomNames(matrixRoomId).includes(livekitRoomName)) {
      return matrixRoomId;
    }
  }
  return null;
}

/**
 * Проверяет, соответствует ли LiveKit room name одному из Matrix room IDs кооператива
 *
 * @param livekitRoomName LiveKit room name из webhook
 * @param membersRoomId Matrix room ID комнаты пайщиков
 * @param councilRoomId Matrix room ID комнаты совета
 * @returns Объект с информацией о соответствии
 */
export function matchLivekitRoomToMatrixRooms(
  livekitRoomName: string,
  membersRoomId: string,
  councilRoomId: string
): {
  isMatch: boolean;
  matrixRoomId: string | null;
  roomType: 'members' | 'council' | null;
  displayName: string | null;
} {
  const possibleRooms = [
    { id: membersRoomId, type: 'members' as const, displayName: 'Комната пайщиков' },
    { id: councilRoomId, type: 'council' as const, displayName: 'Комната совета' }
  ];

  for (const room of possibleRooms) {
    if (candidateLivekitRoomNames(room.id).includes(livekitRoomName)) {
      return {
        isMatch: true,
        matrixRoomId: room.id,
        roomType: room.type,
        displayName: room.displayName
      };
    }
  }

  return {
    isMatch: false,
    matrixRoomId: null,
    roomType: null,
    displayName: null
  };
}

/** Строка реестра для сопоставления LiveKit ↔ Matrix (только незашифрованные комнаты для секретаря). */
export interface SecretaryEligibleMatrixRoomRef {
  matrixRoomId: string;
  displayLabel: string;
}

/**
 * Сопоставляет имя комнаты LiveKit с одной из зарегистрированных незашифрованных Matrix-комнат.
 */
export function matchLivekitRoomToSecretaryEligibleRooms(
  livekitRoomName: string,
  rooms: SecretaryEligibleMatrixRoomRef[]
): {
  isMatch: boolean;
  matrixRoomId: string | null;
  displayName: string | null;
} {
  if (rooms.length === 0) {
    return { isMatch: false, matrixRoomId: null, displayName: null };
  }
  const ids = rooms.map((r) => r.matrixRoomId);
  const matrixRoomId = findMatrixRoomIdForLivekitRoom(livekitRoomName, ids);
  if (!matrixRoomId) {
    return { isMatch: false, matrixRoomId: null, displayName: null };
  }
  const row = rooms.find((r) => r.matrixRoomId === matrixRoomId);
  return {
    isMatch: true,
    matrixRoomId,
    displayName: row?.displayLabel ?? null,
  };
}
