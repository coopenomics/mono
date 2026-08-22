import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, UseFilters, UseGuards } from '@nestjs/common';
import type { EncryptedVaultBlob, VaultSubjectType } from '~/domain/auth-v2/vault/vault.types';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { AuthRateLimit } from '../rate-limit/auth-rate-limit.decorator';
import { AuthRateLimitGuard } from '../rate-limit/auth-rate-limit.guard';
import { LOGIN_IP_RULE } from '../rate-limit/auth-rate-limit.types';
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
  @UseFilters(AuthV2ExceptionFilter)
  @UseGuards(AuthRateLimitGuard)
  // Только per-IP. Раньше здесь стоял ещё и per-account лимит (5 обращений за 15
  // минут по subject_id) против harvest-энумерации блобов — и ломал обычную работу:
  // блоб читается ровно один раз на каждый вход, так что шестой вход пайщика за
  // четверть часа отдавал 429 «не удалось получить vault». Ловится это на ровном
  // месте — телефон плюс ноутбук, перезаход после выхода, перезагрузка вкладки.
  //
  // Защищать перечитывание ОДНОГО блоба и нечем: это одни и те же байты, и без
  // пароля пайщика они бесполезны (см. комментарий выше) — на пятом чтении злодей
  // знает ровно столько же, сколько на первом. Энумерация же идёт вширь, по чужим
  // subject_id, и её ловит per-IP правило, которое осталось на месте.
  @AuthRateLimit({ ip: LOGIN_IP_RULE })
  async retrieveParticipant(@Param('subject_id') subjectId: string): Promise<EncryptedVaultBlob> {
    const blob = await this.vault.retrieve({ subject_type: 'participant', subject_id: subjectId });
    if (!blob)
      throw new NotFoundException('vault не найден');
    return blob;
  }
}
