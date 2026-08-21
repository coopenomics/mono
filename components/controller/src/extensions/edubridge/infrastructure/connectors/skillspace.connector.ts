import { Injectable } from '@nestjs/common';
import { EduAccessCarrier, EduRecipientType } from '../../domain/enums';
import type {
  AccessCarrierConnector,
  AccessRequest,
  ConnectorResult,
  CourseCheckResult,
} from '../../domain/connectors/access-carrier.connector';
import { EdubridgeConfigHolder } from '../../application/config/edubridge-config.holder';
import { classifyHttpFailure, classifyStatus, httpCall } from './http-carrier.base';

/**
 * Skillspace: REST API платформы (Bearer-токен школы). Эндпоинты вынесены в
 * константы — состав и формат подлежат сверке с документацией аккаунта школы:
 *  - GET  /courses/{id}                — карточка курса (проверка и название);
 *  - POST /courses/{id}/students       — пригласить ученика по почте;
 *  - DELETE /courses/{id}/students     — снять доступ ученика по почте.
 * Ответ «уже зачислен» трактуется как успех (`exists`), лимит учеников тарифа —
 * как обнаруживаемое состояние (`LICENSE_LIMIT`).
 */
const SKILLSPACE_API_BASE = 'https://api.skillspace.ru/v1';

@Injectable()
export class SkillspaceConnector implements AccessCarrierConnector {
  readonly carrier = EduAccessCarrier.SKILLSPACE;

  constructor(private readonly config: EdubridgeConfigHolder) {}

  private headers(): Record<string, string> | null {
    const key = this.config.get().connectors.skillspace_api_key;
    if (!key) return null;
    return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' };
  }

  private async studentAction(request: AccessRequest, method: 'POST' | 'DELETE'): Promise<ConnectorResult> {
    const headers = this.headers();
    if (!headers) return { code: 'fatal', message: 'Skillspace не настроен: укажите API-ключ', error_code: 'NOT_CONFIGURED' };
    if (request.recipient.type !== EduRecipientType.EMAIL) {
      return { code: 'fatal', message: 'Skillspace принимает только почту обучающегося', error_code: 'UNSUPPORTED_RECIPIENT' };
    }
    try {
      const res = await httpCall(`${SKILLSPACE_API_BASE}/courses/${encodeURIComponent(request.course_ref)}/students`, {
        method,
        headers,
        body: JSON.stringify({ email: request.recipient.value, send_invite: method === 'POST' }),
      });
      if (res.ok) return { code: 'ok' };
      if (res.status === 409) return { code: 'exists', message: 'Ученик уже зачислен' };
      if (res.status === 402 || /limit|лимит/i.test(res.text)) return { code: 'fatal', message: 'Исчерпан лимит учеников тарифа Skillspace', error_code: 'LICENSE_LIMIT' };
      if (method === 'DELETE' && res.status === 404) return { code: 'exists', message: 'Ученика уже нет на курсе' };
      return classifyStatus(res.status, res.text);
    } catch (e) {
      return classifyHttpFailure(e);
    }
  }

  grant(request: AccessRequest): Promise<ConnectorResult> {
    return this.studentAction(request, 'POST');
  }

  revoke(request: AccessRequest): Promise<ConnectorResult> {
    return this.studentAction(request, 'DELETE');
  }

  async check(_coopname: string, courseRef: string): Promise<CourseCheckResult> {
    const headers = this.headers();
    if (!headers) return { found: false, unavailable: true, message: 'Skillspace не настроен' };
    try {
      const res = await httpCall(`${SKILLSPACE_API_BASE}/courses/${encodeURIComponent(courseRef)}`, { method: 'GET', headers });
      if (res.status === 404) return { found: false, message: 'Курс не найден в Skillspace' };
      if (!res.ok) return { found: false, unavailable: true, message: `HTTP ${res.status}` };
      const data = (res.body ?? {}) as { title?: string; name?: string };
      return { found: true, title: data.title ?? data.name };
    } catch (e) {
      return { found: false, unavailable: true, message: e instanceof Error ? e.message : String(e) };
    }
  }
}
