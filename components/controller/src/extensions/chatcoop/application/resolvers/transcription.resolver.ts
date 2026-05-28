import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
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

/**
 * GraphQL resolver для транскрипций звонков
 *
 * Доступ: любой авторизованный пайщик кооператива (chairman, member, user) — одинаковый доступ к списку и деталям.
 */
@Resolver()
export class TranscriptionResolver {
  private readonly logger = new Logger(TranscriptionResolver.name);

  constructor(
    private readonly transcriptionService: TranscriptionManagementService,
    private readonly matrixApiService: MatrixApiService
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
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('data', { type: () => GetTranscriptionsInputDTO, nullable: true })
    data?: GetTranscriptionsInputDTO
  ): Promise<CallTranscriptionResponseDTO[]> {
    const limit = data?.limit || 20;
    const offset = data?.offset || 0;

    this.logger.log(
      `Запрос транскрипций: user=${currentUser.username}, role=${currentUser.role}, limit=${limit}, offset=${offset}`
    );

    const rows = data?.matrixRoomId
      ? await this.transcriptionService.getTranscriptionsByRoom(data.matrixRoomId)
      : await this.transcriptionService.getAllTranscriptions({ limit, offset });
    return Promise.all(rows.map((t) => this.toCallTranscriptionResponse(t)));
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
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('data', { type: () => GetTranscriptionInputDTO }) data: GetTranscriptionInputDTO
  ): Promise<CallTranscriptionWithSegmentsDTO | null> {
    this.logger.log(`Запрос транскрипции ${data.id}: user=${currentUser.username}, role=${currentUser.role}`);

    const result = await this.transcriptionService.getTranscriptionWithSegments(data.id);
    if (!result) {
      return null;
    }

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
  @AuthRoles(['chairman', 'member'])
  async updateTranscriptionMemo(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('data', { type: () => UpdateCallTranscriptionMemoInputDTO }) data: UpdateCallTranscriptionMemoInputDTO
  ): Promise<CallTranscriptionResponseDTO> {
    this.logger.log(
      `Обновление memo транскрипции ${data.id}: user=${currentUser.username}, role=${currentUser.role}`
    );
    const updated = await this.transcriptionService.updateTranscriptionMemo(data.id, data.memo);
    return this.toCallTranscriptionResponse(updated);
  }
}
