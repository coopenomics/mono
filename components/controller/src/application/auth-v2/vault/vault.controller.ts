import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import type { EncryptedVaultBlob, VaultSubjectType } from '~/domain/auth-v2/vault/vault.types';
import { VaultService } from './vault.service';

interface StoreVaultDto extends EncryptedVaultBlob {
  subject_type: VaultSubjectType;
  subject_id: string;
}

/**
 * REST-приём зашифрованного блоба от клиента (Story 2.1). Тело уже зашифровано
 * на клиенте — сервер только сохраняет. Авторизация bearer/grant — Эпик 6 (CASL);
 * на этапе 2.1 эндпоинт принимает blob как есть (write-only, без чтения секретов).
 */
@Controller('coop/vault')
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  @Post()
  @HttpCode(201)
  async store(@Body() dto: StoreVaultDto): Promise<void> {
    const { subject_type, subject_id, ...blob } = dto;
    await this.vault.store({ subject_type, subject_id }, blob);
  }

  /**
   * Отдаёт ТОЛЬКО зашифрованный blob пайщика (Story 2.2): SDK расшифровывает его
   * клиентским паролём (type-ban серверной расшифровки из 2.1 в силе — retrieve
   * не несёт секрета). Blob криптографически бесполезен без пароля, поэтому на
   * этом шаге эндпоинт не гейтится сессией; session-гейтинг придёт с verify-flow
   * (Stories 1.7+). 404 — vault'а у субъекта нет.
   */
  @Get('participant/:subject_id')
  async retrieveParticipant(@Param('subject_id') subjectId: string): Promise<EncryptedVaultBlob> {
    const blob = await this.vault.retrieve({ subject_type: 'participant', subject_id: subjectId });
    if (!blob)
      throw new NotFoundException('vault не найден');
    return blob;
  }
}
