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
 * Skillspace — открытый API школы (справка: help.skillspace.ru/api, раздел
 * «Настройки школы — API» аккаунта):
 *  - POST https://skillspace.ru/api/open/v1/course/student-invite
 *      token, email, courses[<ID_КУРСА>]=<ID_ГРУППЫ> (группа пуста — подбирается
 *      автоматически), name — пригласить ученика на курс; письмо шлёт площадка;
 *  - POST https://skillspace.ru/api/open/v1/course/:id/student-remove
 *      token, email — снять ученика с курса.
 * Ответ — `{}` при успехе; 400 — неверные данные, 401 — неверный ключ.
 *
 * `course_ref` курса — `<ID_КУРСА>` или `<ID_КУРСА>:<ID_ГРУППЫ>`.
 * Площадке передаётся только почта обучающегося; имя не передаём.
 * Карточку курса API не отдаёт — сверка названия недоступна, поэтому
 * `check` подтверждает лишь доступность API и корректность ключа.
 */
const SKILLSPACE_API_BASE = 'https://skillspace.ru/api/open/v1';

function splitRef(ref: string): { course: string; group: string } {
  const [course, group = ''] = ref.split(':');
  return { course: course?.trim() ?? '', group: group.trim() };
}

@Injectable()
export class SkillspaceConnector implements AccessCarrierConnector {
  readonly carrier = EduAccessCarrier.SKILLSPACE;

  constructor(private readonly config: EdubridgeConfigHolder) {}

  private token(): string {
    return this.config.get().connectors.skillspace_api_key;
  }

  private async post(path: string, body: URLSearchParams): Promise<ConnectorResult> {
    try {
      const res = await httpCall(`${SKILLSPACE_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });
      if (res.ok) return { code: 'ok' };
      if (res.status === 401) return { code: 'fatal', message: 'Skillspace: неверный API-ключ школы', error_code: 'UNAUTHORIZED' };
      if (res.status === 400) return { code: 'fatal', message: `Skillspace: неверные данные — ${res.text.slice(0, 200)}`, error_code: 'BAD_REQUEST' };
      return classifyStatus(res.status, res.text);
    } catch (e) {
      return classifyHttpFailure(e);
    }
  }

  async grant(request: AccessRequest): Promise<ConnectorResult> {
    const token = this.token();
    if (!token) return { code: 'fatal', message: 'Skillspace не настроен: укажите API-ключ школы', error_code: 'NOT_CONFIGURED' };
    if (request.recipient.type !== EduRecipientType.EMAIL) {
      return { code: 'fatal', message: 'Skillspace принимает только почту обучающегося', error_code: 'UNSUPPORTED_RECIPIENT' };
    }
    const { course, group } = splitRef(request.course_ref);
    if (!course) return { code: 'fatal', message: 'У курса не задан идентификатор курса Skillspace', error_code: 'NO_COURSE_REF' };
    const body = new URLSearchParams({ token, email: request.recipient.value });
    body.append(`courses[${course}]`, group);
    return this.post('/course/student-invite', body);
  }

  async revoke(request: AccessRequest): Promise<ConnectorResult> {
    const token = this.token();
    if (!token) return { code: 'fatal', message: 'Skillspace не настроен: укажите API-ключ школы', error_code: 'NOT_CONFIGURED' };
    if (request.recipient.type !== EduRecipientType.EMAIL) {
      return { code: 'fatal', message: 'Skillspace принимает только почту обучающегося', error_code: 'UNSUPPORTED_RECIPIENT' };
    }
    const { course } = splitRef(request.course_ref);
    if (!course) return { code: 'fatal', message: 'У курса не задан идентификатор курса Skillspace', error_code: 'NO_COURSE_REF' };
    const result = await this.post(`/course/${encodeURIComponent(course)}/student-remove`, new URLSearchParams({ token, email: request.recipient.value }));
    // Ученика уже нет на курсе — площадка отвечает 400; для отзыва это достигнутая цель.
    if (result.code === 'fatal' && result.error_code === 'BAD_REQUEST') return { code: 'exists', message: 'Ученика уже нет на курсе' };
    return result;
  }

  async check(_coopname: string, courseRef: string): Promise<CourseCheckResult> {
    const token = this.token();
    if (!token) return { found: false, unavailable: true, message: 'Skillspace не настроен' };
    const { course } = splitRef(courseRef);
    if (!course) return { found: false, message: 'У курса не задан идентификатор курса Skillspace' };
    // Карточки курса у открытого API нет: проверяем доступность API и ключ
    // запросом без почты — 400 «неверные данные» означает, что ключ принят.
    try {
      const res = await httpCall(`${SKILLSPACE_API_BASE}/course/student-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
      if (res.status === 401) return { found: false, unavailable: true, message: 'Skillspace: неверный API-ключ школы' };
      if (res.status >= 500) return { found: false, unavailable: true, message: `Skillspace недоступен (HTTP ${res.status})` };
      return { found: true, message: 'Открытый API Skillspace не отдаёт карточку курса — сверка названия недоступна' };
    } catch (e) {
      return { found: false, unavailable: true, message: e instanceof Error ? e.message : String(e) };
    }
  }
}
