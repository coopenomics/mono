/**
 * События между программой проектов (Capital) и мессенджером кооператива (ChatCoop).
 * Смысл: у каждого проекта Благороста — своя комната в Matrix; пайщик попадает туда, когда совет подтвердил его заявку
 * и когда у него есть учётная запись Matrix в этом кооперативе. Порядок шагов может быть любым, поэтому несколько точек синхронизации.
 */
/** В системе зафиксирован новый проект — нужно завести под него комнату в Matrix кооператива */
export const CAPITAL_PROJECT_CREATED_EVENT = 'capital.project.created' as const;

/** Комната для проекта создана — пора сохранить её адрес в данных проекта и пригласить тех, кому участие уже разрешили */
export const CAPITAL_PROJECT_MATRIX_ROOM_ASSIGNED_EVENT = 'capital.project.matrix_room_assigned' as const;

/** Данные для ChatCoop без импорта доменной сущности Capital */
export interface ICapitalProjectCreatedPayload {
  project_hash: string;
  title: string;
}

export interface ICapitalProjectMatrixRoomAssignedPayload {
  project_hash: string;
  matrix_room_id: string;
}

/** Команда в ChatCoop: join + power levels (источники: допуск, назначение комнаты, linked) */
export const CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT =
  'chatcoop.capital_project_room.ensure_member' as const;

export interface IChatCoopCapitalProjectRoomEnsureMemberPayload {
  username: string;
  matrix_room_id: string;
}

/**
 * Пайщик готов пользоваться Matrix в этом кооперативе (общие чаты настроены).
 * Нужно проверить все проекты, где у него уже подтверждён допуск, и внести его в соответствующие комнаты проектов.
 */
export const CHATCOOP_MATRIX_USER_LINKED_FOR_CAPITAL_PROJECT_ROOMS_EVENT =
  'chatcoop.matrix.user.linked_for_capital_project_rooms' as const;

export interface IChatCoopMatrixUserLinkedForCapitalProjectRoomsPayload {
  username: string;
}
