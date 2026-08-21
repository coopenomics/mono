import { Injectable } from '@nestjs/common';
import { EduAccessCarrier } from '../../domain/enums';
import type { AccessCarrierConnector, AccessRequest, ConnectorResult, CourseCheckResult } from '../../domain/connectors/access-carrier.connector';

/**
 * Очный формат: пропуск — запись в самом приложении (проверка на входе по коду
 * обучающегося). Внешней площадки нет, поэтому выдача и отзыв всегда успешны,
 * а состояние доступа в подписке и есть пропуск.
 */
@Injectable()
export class OnsiteConnector implements AccessCarrierConnector {
  readonly carrier = EduAccessCarrier.ONSITE;

  async grant(_request: AccessRequest): Promise<ConnectorResult> {
    return { code: 'ok' };
  }

  async revoke(_request: AccessRequest): Promise<ConnectorResult> {
    return { code: 'ok' };
  }

  async check(_coopname: string, courseRef: string): Promise<CourseCheckResult> {
    return { found: true, title: courseRef };
  }
}
