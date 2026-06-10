import { Body, Controller, HttpCode, Post } from '@nestjs/common';
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
}
