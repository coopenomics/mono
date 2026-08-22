import { Controller, Get } from '@nestjs/common';
import config from '~/config/config';
import { buildClaimsPolicy, type CoopIdClaimsPolicy } from './retention-policy';

/**
 * Публичная политика claims удостоверения (Story 4.8): описывает retention-обязательство,
 * встроенное в participant_certificate, и ссылается на договор присоединения. Читается
 * внешним сервисом (RP) без аутентификации — guard'а нет. Global prefix не задан →
 * путь в корне: `GET /.well-known/coopid-claims-policy.json`.
 */
@Controller('.well-known')
export class CoopIdClaimsPolicyController {
  @Get('coopid-claims-policy.json')
  getClaimsPolicy(): CoopIdClaimsPolicy {
    return buildClaimsPolicy(config.coopname);
  }
}
