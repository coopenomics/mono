import { Inject, Injectable } from '@nestjs/common';
import type {
  InterCompletedCallTranscriptionHead,
  InterNonProjectCommunicationRoomRef,
  InterNonProjectRoomKind,
  InterProjectCommunicationArtifactsPort,
  InterProjectCommunicationRoomRef,
  InterRoomMessageLine,
} from '@coopenomics/inter';
import { MatrixApiService } from '../../application/services/matrix-api.service';
import { CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY } from '../../domain/repositories/managed-matrix-room.repository';
import type { ChatcoopManagedMatrixRoomRepository } from '../../domain/repositories/managed-matrix-room.repository';
import {
  ROOM_MESSAGE_HISTORY_REPOSITORY,
  type RoomMessageHistoryRepository,
} from '../../domain/repositories/room-message-history.repository';
import {
  MATRIX_USER_REPOSITORY,
  type MatrixUserRepository,
} from '../../domain/repositories/matrix-user.repository';
import { TranscriptionManagementService } from '../../domain/services/transcription-management.service';
import { ChatcoopRoomMessageKind } from '../../domain/entities/room-message-history.entity';
import { TranscriptionStatus } from '../../domain/entities/call-transcription.entity';
import {
  CALL_TRANSCRIPTION_REPOSITORY,
  type CallTranscriptionRepository,
} from '../../domain/repositories/call-transcription.repository';
import { canonicalizeMatrixUserId } from '../../domain/utils/matrix-user-id.util';

@Injectable()
export class ChatcoopInterProjectCommunicationArtifactsAdapter implements InterProjectCommunicationArtifactsPort {
  constructor(
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedRooms: ChatcoopManagedMatrixRoomRepository,
    @Inject(ROOM_MESSAGE_HISTORY_REPOSITORY)
    private readonly messageHistory: RoomMessageHistoryRepository,
    @Inject(CALL_TRANSCRIPTION_REPOSITORY)
    private readonly callTranscriptions: CallTranscriptionRepository,
    @Inject(MATRIX_USER_REPOSITORY)
    private readonly matrixUsers: MatrixUserRepository,
    private readonly matrixApi: MatrixApiService,
    private readonly transcriptionManagement: TranscriptionManagementService
  ) {}

  async listCommunicationRoomsForProject(projectHash: string): Promise<InterProjectCommunicationRoomRef[]> {
    const rooms = await this.managedRooms.findByProjectHash(projectHash);
    return rooms.map((r) => ({
      matrixRoomId: r.matrixRoomId,
      displayLabel: r.displayLabel || r.matrixRoomId,
    }));
  }

  async listNonProjectCommunicationRooms(): Promise<InterNonProjectCommunicationRoomRef[]> {
    const rooms = await this.managedRooms.findNonProjectCommunicationRooms();
    return rooms
      .filter((r): r is typeof r & { kind: InterNonProjectRoomKind } =>
        r.kind === 'members' || r.kind === 'council' || r.kind === 'secretary'
      )
      .map((r) => ({
        matrixRoomId: r.matrixRoomId,
        displayLabel: r.displayLabel || r.matrixRoomId,
        kind: r.kind,
      }));
  }

  async listUtcDatesWithNewMessages(
    matrixRoomId: string,
    afterOriginServerTsExclusive: number
  ): Promise<string[]> {
    return this.messageHistory.listDistinctUtcDatesWithNewMessagesAfter(
      matrixRoomId,
      afterOriginServerTsExclusive
    );
  }

  async getMessagesForRoomAndUtcDate(matrixRoomId: string, utcDate: string): Promise<InterRoomMessageLine[]> {
    const rows = await this.messageHistory.listMessagesForRoomOnUtcDate(matrixRoomId, utcDate);
    return rows
      .filter((m) => m.messageKind !== ChatcoopRoomMessageKind.AUDIO_STT_FAIL)
      .map((m) => ({
        originServerTs: m.originServerTs,
        authorLabel: m.senderDisplayName?.trim() || m.coopUsername || m.senderMatrixUserId,
        coopUsername: m.coopUsername,
        kind: m.messageKind === ChatcoopRoomMessageKind.TEXT ? 'text' : 'audio',
        bodyText: m.bodyText,
      }));
  }

  async getMaxOriginServerTsForRoom(matrixRoomId: string): Promise<number | null> {
    return this.messageHistory.getMaxOriginServerTsForRoom(matrixRoomId);
  }

  async listCompletedTranscriptionsEndedAfter(
    matrixRoomIds: string[],
    endedAfterExclusive: Date
  ): Promise<InterCompletedCallTranscriptionHead[]> {
    const list = await this.callTranscriptions.findCompletedByMatrixRoomIdsEndedAfter(
      matrixRoomIds,
      endedAfterExclusive
    );
    return list.map((t) => ({
      id: t.id,
      matrixRoomId: t.matrixRoomId,
      roomName: t.roomName,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
    }));
  }

  async getMaxCompletedEndedAtForRooms(matrixRoomIds: string[]): Promise<Date | null> {
    return this.callTranscriptions.getMaxCompletedEndedAtForRooms(matrixRoomIds);
  }

  /**
   * Как в сообщениях GitHub / ingest: displayname Synapse, при привязке — `имя (@coopUsername)`.
   * Идентично идее TranscriptionResolver.mapSegmentsForResponse + аккаунт кооператива.
   */
  private async resolveTranscriptionSpeakerLabelForGithub(
    rawIdentity: string,
    displayByCanon: Map<string, string>,
    coopByCanon: Map<string, string | null>
  ): Promise<string> {
    const canon = canonicalizeMatrixUserId(rawIdentity);
    let display = displayByCanon.get(canon);
    if (display === undefined) {
      display = await this.matrixApi.resolveMatrixUserDisplayName(canon);
      displayByCanon.set(canon, display);
    }
    let coop = coopByCanon.get(canon);
    if (coop === undefined) {
      const linked = await this.matrixUsers.findByMatrixUserId(canon);
      coop = linked?.coopUsername?.trim() || null;
      coopByCanon.set(canon, coop);
    }
    const authorLabel = display.trim() || coop || canon;
    return coop ? `${authorLabel} (@${coop})` : authorLabel;
  }

  async renderCompletedCallTranscriptionMarkdown(transcriptionId: string): Promise<string | null> {
    const pack = await this.transcriptionManagement.getTranscriptionWithSegments(transcriptionId);
    if (!pack || pack.transcription.status !== TranscriptionStatus.COMPLETED) {
      return null;
    }
    const { transcription, segments } = pack;
    const sorted = [...segments].sort((a, b) => a.startOffset - b.startOffset);
    const displayByCanon = new Map<string, string>();
    const coopByCanon = new Map<string, string | null>();
    const lines = await Promise.all(
      sorted.map(async (s) => {
        const who = await this.resolveTranscriptionSpeakerLabelForGithub(
          s.speakerIdentity,
          displayByCanon,
          coopByCanon
        );
        return `**${who}** (${s.startOffset.toFixed(1)}–${s.endOffset.toFixed(1)} s)\n\n${s.text.trim()}`;
      })
    );
    const header = [
      `# Транскрипция звонка`,
      ``,
      `- Matrix room: \`${transcription.matrixRoomId}\``,
      `- LiveKit room: \`${transcription.roomId}\``,
      `- Начало: ${transcription.startedAt.toISOString()}`,
      `- Окончание: ${transcription.endedAt?.toISOString() ?? '—'}`,
      ``,
    ].join('\n');
    return `${header}\n${lines.join('\n\n---\n\n')}\n`;
  }
}
