import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { PROJECT_CAPITAL_CLEARANCE_PORT, type IProjectCapitalClearancePort } from '@coopenomics/innercoop';
import type { IMonoAccount } from '@coopenomics/innercoop';
import {
  CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY,
  type ChatcoopManagedMatrixRoomRepository,
} from '../../domain/repositories/managed-matrix-room.repository';
import type { ManagedMatrixRoomDomainEntity } from '../../domain/entities/managed-matrix-room.entity';

/**
 * Кто вправе читать переписку и записи звонков.
 *
 * Комната проекта — по матрице доступа capital (совет и ведущий проекта; допуск к проекту
 * переписку не открывает). Комнаты пайщиков, совета и секретаря к проектам не привязаны,
 * их читает только совет.
 *
 * Проверка идёт по самой комнате, а не по роли в запросе: иначе достаточно было бы подставить
 * чужой matrixRoomId, чтобы вычитать переписку мимо ограничений.
 */
@Injectable()
export class ChatcoopCommunicationAccessService {
  constructor(
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedRooms: ChatcoopManagedMatrixRoomRepository,
    @Optional()
    @Inject(PROJECT_CAPITAL_CLEARANCE_PORT)
    private readonly capitalClearance: IProjectCapitalClearancePort | undefined
  ) {}

  isBoardMember(user: Pick<IMonoAccount, 'role'> | undefined): boolean {
    return user?.role === 'chairman' || user?.role === 'member';
  }

  /** Вправе ли пользователь читать переписку проекта Capital. */
  async canReadProjectRooms(
    user: Pick<IMonoAccount, 'username' | 'role'> | undefined,
    projectHash: string
  ): Promise<boolean> {
    if (this.isBoardMember(user)) {
      return true;
    }
    const username = user?.username;
    if (!username || !projectHash.trim()) {
      return false;
    }
    if (!this.capitalClearance) {
      // Без capital ответить о правах на проект нечем — читать не даём.
      return false;
    }
    return this.capitalClearance.canReadProjectCommunication({
      username,
      role: user?.role,
      projectHash,
    });
  }

  /** Вправе ли пользователь читать конкретную комнату Matrix. */
  async canReadRoom(
    user: Pick<IMonoAccount, 'username' | 'role'> | undefined,
    matrixRoomId: string
  ): Promise<boolean> {
    const room = await this.managedRooms.findByMatrixRoomId(matrixRoomId);
    if (!room) {
      return false;
    }
    return this.canReadKnownRoom(user, room);
  }

  /** То же для уже загруженной записи реестра — чтобы не перечитывать её на каждый вопрос. */
  async canReadKnownRoom(
    user: Pick<IMonoAccount, 'username' | 'role'> | undefined,
    room: ManagedMatrixRoomDomainEntity
  ): Promise<boolean> {
    if (room.kind === 'capital_project') {
      return room.projectHash ? this.canReadProjectRooms(user, room.projectHash) : false;
    }
    return this.isBoardMember(user);
  }

  /** Отказ вместо пустого ответа: запрос к чужой комнате — это ошибка доступа, а не пустая история. */
  async assertCanReadRoom(
    user: Pick<IMonoAccount, 'username' | 'role'> | undefined,
    matrixRoomId: string
  ): Promise<void> {
    if (!(await this.canReadRoom(user, matrixRoomId))) {
      throw new ForbiddenException(
        'Нет доступа к переписке этой комнаты: её читают совет и ведущий проекта'
      );
    }
  }

  /** Комнаты, доступные пользователю на чтение, — для запросов без указания комнаты. */
  async listReadableRoomIds(
    user: Pick<IMonoAccount, 'username' | 'role'> | undefined
  ): Promise<string[]> {
    const rooms = await this.managedRooms.findAll();
    const checks = await Promise.all(
      rooms.map(async (room) => ((await this.canReadKnownRoom(user, room)) ? room.matrixRoomId : null))
    );
    return checks.filter((id): id is string => id !== null);
  }
}
