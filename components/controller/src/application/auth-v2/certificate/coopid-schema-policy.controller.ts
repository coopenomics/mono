import { Controller, Get } from '@nestjs/common';
import { buildSchemaPolicy, type CoopIdSchemaPolicy } from './schema-policy';

/**
 * Публичная политика версий схемы удостоверения (Story 4.10): какая версия схемы
 * claims актуальна и какая ещё поддерживается. Читается верификатором (SDK/RP) без
 * аутентификации — guard'а нет. Global prefix не задан → путь в корне:
 * `GET /.well-known/coopid-schema-policy.json`. Политика глобальная (схема общая
 * для платформы в MVP), per-coop версионирование и on-chain публикация — Growth.
 */
@Controller('.well-known')
export class CoopIdSchemaPolicyController {
  @Get('coopid-schema-policy.json')
  getSchemaPolicy(): CoopIdSchemaPolicy {
    return buildSchemaPolicy();
  }
}
