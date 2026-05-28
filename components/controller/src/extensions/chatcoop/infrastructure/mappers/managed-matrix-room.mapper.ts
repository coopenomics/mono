import type { ManagedMatrixRoomDomainEntity } from '../../domain/entities/managed-matrix-room.entity';
import type { ChatcoopManagedMatrixRoomKind } from '../../domain/entities/managed-matrix-room.entity';
import { ManagedMatrixRoomTypeormEntity } from '../entities/managed-matrix-room.typeorm-entity';

function parseKind(raw: string): ChatcoopManagedMatrixRoomKind {
  if (raw === 'members' || raw === 'council' || raw === 'capital_project' || raw === 'secretary') {
    return raw;
  }
  return 'capital_project';
}

export const ManagedMatrixRoomMapper = {
  toDomain(entity: ManagedMatrixRoomTypeormEntity): ManagedMatrixRoomDomainEntity {
    return {
      id: entity.id,
      matrixRoomId: entity.matrixRoomId,
      encrypted: entity.encrypted,
      kind: parseKind(entity.roomKind),
      displayLabel: entity.displayLabel,
      projectHash: entity.projectHash,
      secretaryInRoom: entity.secretaryInRoom,
      messageHistoryPaginationToken: entity.messageHistoryPaginationToken ?? null,
      messageHistoryBackfillComplete: entity.messageHistoryBackfillComplete ?? false,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
