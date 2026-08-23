import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { TranscriptionManagementService } from '../../domain/services/transcription-management.service';
import { MatrixApiService } from '../services/matrix-api.service';
import { canonicalizeMatrixUserId } from '../../domain/utils/matrix-user-id.util';
import type { CallTranscriptionDomainEntity } from '../../domain/entities/call-transcription.entity';
import type { TranscriptionSegmentDomainEntity } from '../../domain/entities/transcription-segment.entity';
import {
  CallTranscriptionResponseDTO,
  CallTranscriptionWithSegmentsDTO,
  GetTranscriptionsInputDTO,
  GetTranscriptionInputDTO,
  TranscriptionSegmentResponseDTO,
  UpdateCallTranscriptionMemoInputDTO,
} from '../dto/transcription.dto';
import { ChatcoopCommunicationAccessService } from '../services/chatcoop-communication-access.service';

/**
 * GraphQL resolver для транскрипций звонков
 *
 * Доступ: записи звонков читают совет и ведущий проекта, к которому привязана комната.
 * Проверка идёт по комнате записи, а не по роли в запросе.
 */
@Resolver()
export class TranscriptionResolver {
  private readonly logger = new Logger(TranscriptionResolver.name);

  constructor(
    private readonly transcriptionService: TranscriptionManagementService,
    private readonly matrixApiService: MatrixApiService,
    private readonly access: ChatcoopCommunicationAccessService
  ) {}

  /**
   * Уникальные канонические MXID в порядке первого появления; в GraphQL participants — displayname Synapse.
   */
  private async toCallTranscriptionResponse(
    domain: CallTranscriptionDomainEntity
  ): Promise<CallTranscriptionResponseDTO> {
    const seen = new Set<string>();
    const orderedCanon: string[] = [];
    for (const p of domain.participants) {
      const c = canonicalizeMatrixUserId(p);
      if (!seen.has(c)) {
        seen.add(c);
        orderedCanon.push(c);
      }
    }
    const participantLabels = await Promise.all(
      orderedCanon.map((id) => this.matrixApiService.resolveMatrixUserDisplayName(id))
    );
    return {
      id: domain.id,
      roomId: domain.roomId,
      roomName: domain.roomName,
      startedAt: domain.startedAt,
      endedAt: domain.endedAt,
      participants: participantLabels,
      status: domain.status,
      memo: domain.memo,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }

  /**
   * Сегменты в БД хранят LiveKit identity с суффиксом; в API — канонический MXID и displayname Synapse.
   */
  private async mapSegmentsForResponse(
    segments: TranscriptionSegmentDomainEntity[]
  ): Promise<TranscriptionSegmentResponseDTO[]> {
    const labelByCanon = new Map<string, string>();

    const resolveLabel = async (rawIdentity: string): Promise<string> => {
      const canon = canonicalizeMatrixUserId(rawIdentity);
      const cached = labelByCanon.get(canon);
      if (cached !== undefined) {
        return cached;
      }
      const label = await this.matrixApiService.resolveMatrixUserDisplayName(canon);
      labelByCanon.set(canon, label);
      return label;
    };

    return Promise.all(
      segments.map(async (s) => {
        const canon = canonicalizeMatrixUserId(s.speakerIdentity);
        const speakerName = await resolveLabel(s.speakerIdentity);
        return {
          id: s.id,
          speakerIdentity: canon,
          speakerName,
          text: s.text,
          startOffset: s.startOffset,
          endOffset: s.endOffset,
          createdAt: s.createdAt,
        };
      })
    );
  }

  /**
   * Получить список транскрипций (все роли кооператива — одинаково)
   */
  @Query(() => [CallTranscriptionResponseDTO], {
    name: 'chatcoopGetTranscriptions',
    description: 'Получить список транскрипций звонков',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getTranscriptions(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => GetTranscriptionsInputDTO, nullable: true })
    data?: GetTranscriptionsInputDTO
  ): Promise<CallTranscriptionResponseDTO[]> {
    const limit = data?.limit || 20;
    const offset = data?.offset || 0;

    this.logger.log(
      `Запрос транскрипций: user=${currentUser.username}, role=${currentUser.role}, limit=${limit}, offset=${offset}`
    );

    if (data?.matrixRoomId) {
      await this.access.assertCanReadRoom(currentUser, data.matrixRoomId);
      const rows = await this.transcriptionService.getTranscriptionsByRoom(data.matrixRoomId);
      return Promise.all(rows.map((t) => this.toCallTranscriptionResponse(t)));
    }

    // Без указания комнаты отдаём только записи тех комнат, которые пользователю доступны.
    const readableRoomIds = new Set(await this.access.listReadableRoomIds(currentUser));
    if (readableRoomIds.size === 0) {
      return [];
    }
    const rows = await this.transcriptionService.getAllTranscriptions({ limit, offset });
    // Сверяем комнату Matrix: roomId у записи — имя комнаты LiveKit, реестру комнат оно неизвестно.
    const visible = rows.filter((t) => readableRoomIds.has(t.matrixRoomId));
    return Promise.all(visible.map((t) => this.toCallTranscriptionResponse(t)));
  }

  /**
   * Получить детальную транскрипцию с сегментами
   */
  @Query(() => CallTranscriptionWithSegmentsDTO, {
    name: 'chatcoopGetTranscription',
    description: 'Получить детальную транскрипцию с сегментами',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getTranscription(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => GetTranscriptionInputDTO }) data: GetTranscriptionInputDTO
  ): Promise<CallTranscriptionWithSegmentsDTO | null> {
    this.logger.log(`Запрос транскрипции ${data.id}: user=${currentUser.username}, role=${currentUser.role}`);

    const result = await this.transcriptionService.getTranscriptionWithSegments(data.id);
    if (!result) {
      return null;
    }
    await this.access.assertCanReadRoom(currentUser, result.transcription.matrixRoomId);

    return {
      transcription: await this.toCallTranscriptionResponse(result.transcription),
      segments: await this.mapSegmentsForResponse(result.segments),
    };
  }

  /**
   * Сохранить пользовательскую заметку к транскрипции (список и деталь отдают поле memo)
   */
  @Mutation(() => CallTranscriptionResponseDTO, {
    name: 'chatcoopUpdateTranscriptionMemo',
    description: 'Обновить заметку (memo) к транскрипции звонка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  // Заметку правит тот же круг, что и читает запись: доступ к самой комнате проверяется ниже.
  @AuthRoles(['chairman', 'member', 'user'])
  async updateTranscriptionMemo(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { type: () => UpdateCallTranscriptionMemoInputDTO }) data: UpdateCallTranscriptionMemoInputDTO
  ): Promise<CallTranscriptionResponseDTO> {
    this.logger.log(
      `Обновление memo транскрипции ${data.id}: user=${currentUser.username}, role=${currentUser.role}`
    );
    const existing = await this.transcriptionService.getTranscriptionWithSegments(data.id);
    if (existing) {
      await this.access.assertCanReadRoom(currentUser, existing.transcription.matrixRoomId);
    }
    const updated = await this.transcriptionService.updateTranscriptionMemo(data.id, data.memo);
    return this.toCallTranscriptionResponse(updated);
  }
}
