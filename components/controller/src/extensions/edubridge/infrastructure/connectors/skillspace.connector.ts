import { Injectable } from '@nestjs/common';
import { EduAccessCarrier, EduRecipientType } from '../../domain/enums';
import type {
  AccessCarrierConnector,
  AccessRequest,
  ConnectorResult,
  CourseCheckResult,
} from '../../domain/connectors/access-carrier.connector';
import { Inject } from '@nestjs/common';
import { CONNECTOR_CREDENTIALS_SOURCE, type ConnectorCredentialField, type IConnectorCredentialsSource } from '../../domain/connectors/connector-credentials';
import { classifyHttpFailure, classifyStatus, httpCall } from './http-carrier.base';

/**
 * Skillspace — открытый API школы (документация в настройках школы, раздел API;
 * хост `skillspace.ru`, ключ — `token`):
 *  - GET|POST /api/open/v1/course/student-invite
 *      token, email, courses[<ID_КУРСА>]=<ID_ГРУППЫ>, name, comment, fields —
 *      пригласить ученика (группа пуста — подбирается по настройкам курса);
 *  - GET|POST /api/open/v1/course/:id/student-remove  token, email —
 *      снять ученика с курса (`all` — со всех курсов; мы его не используем);
 *  - GET /api/open/v1/school/course/list?token=…  — курсы {id, name, slug, …};
 *  - GET /api/open/v1/school/group/list?token=…   — группы {id, courseId, name, studentsCount};
 *  - GET /api/open/v1/course/structure?token=…&courseId=… — структура курса.
 * Ответы по документации: 200 `{}`/пусто — успех; 400 — неверные данные;
 * 401 — неверный ключ; 403 — доступ запрещён; 405 — метод не поддерживается.
 * Проверено на живой школе 2026-08-21: приглашение работает и на
 * НЕопубликованный курс и без группы; первый invite нового ученика отвечает
 * 200 `{"passwordSetupLink": …}`, повторный — 200 `{}` (идемпотентно);
 * remove идемпотентен (200 `{}`); ошибки приходят как 404 с кодом в теле —
 * `{"COURSE_NOT_FOUND": …}`, `{"SCHOOL_PUBLIC_TOKEN_NOT_FOUND": …}`.
 *
 * `course_ref` курса — `<ID_КУРСА>` или `<ID_КУРСА>:<ID_ГРУППЫ>` (UUID).
 * Площадке передаётся только почта обучающегося; имя не передаём.
 */
const SKILLSPACE_API_BASE = 'https://skillspace.ru/api/open/v1';

export function splitSkillspaceRef(ref: string): { course: string; group: string } {
  const [course, group = ''] = ref.split(':');
  return { course: course?.trim() ?? '', group: group.trim() };
}

/**
 * Курс школы в реестре `school/course/list`. Идентификатор — UUID; числовой
 * номер из адреса конструктора (`/course/131851/...`) в API не существует,
 * поэтому в курсе кооператива хранится именно `id`.
 */
export interface SkillspaceCourse {
  id: string;
  name: string;
  slug?: string;
}
export interface SkillspaceGroup {
  id: string;
  courseId: string;
  name: string;
  studentsCount?: number;
}

@Injectable()
export class SkillspaceConnector implements AccessCarrierConnector {
  readonly carrier = EduAccessCarrier.SKILLSPACE;

  readonly credentialFields: ConnectorCredentialField[] = [
    { key: 'api_key', label: 'API-ключ школы', secret: true, note: 'Настройки школы Skillspace → Интеграции → Open API' },
  ];

  constructor(@Inject(CONNECTOR_CREDENTIALS_SOURCE) private readonly credentials: IConnectorCredentialsSource) {}

  private async token(coopname: string): Promise<string> {
    return (await this.credentials.get(coopname, this.carrier)).api_key ?? '';
  }

  private async post(path: string, body: URLSearchParams): Promise<ConnectorResult> {
    try {
      const res = await httpCall(`${SKILLSPACE_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });
      if (res.ok) return { code: 'ok' };
      return this.classifyError(res.status, res.text, this.apiErrorCode(res.body));
    } catch (e) {
      return classifyHttpFailure(e);
    }
  }

  /** Ошибки Skillspace приходят 404 с кодом в теле, а не 401/400 — код важнее статуса. */
  private classifyError(status: number, text: string, apiCode: string | null | undefined): ConnectorResult {
    if (status === 401 || apiCode === 'SCHOOL_PUBLIC_TOKEN_NOT_FOUND') {
      return { code: 'fatal', message: 'Skillspace: неверный API-ключ школы', error_code: 'UNAUTHORIZED' };
    }
    if (apiCode === 'COURSE_NOT_FOUND') return { code: 'fatal', message: 'Skillspace: курс не найден в школе', error_code: 'COURSE_NOT_FOUND' };
    if (status === 403) return { code: 'fatal', message: 'Skillspace: доступ запрещён для этого ключа', error_code: 'FORBIDDEN' };
    if (status === 400 || status === 404) {
      return { code: 'fatal', message: `Skillspace: ${apiCode ?? text.slice(0, 200)}`, error_code: apiCode ?? 'BAD_REQUEST' };
    }
    return classifyStatus(status, text);
  }

  private async getJson<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
    try {
      const res = await httpCall(`${SKILLSPACE_API_BASE}${path}`, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const apiCode = this.apiErrorCode(res.body);
        const unauthorized = res.status === 401 || apiCode === 'SCHOOL_PUBLIC_TOKEN_NOT_FOUND';
        return { ok: false, status: res.status, message: unauthorized ? 'Skillspace: неверный API-ключ школы' : `HTTP ${res.status}${apiCode ? ` ${apiCode}` : ''}` };
      }
      return { ok: true, data: res.body as T };
    } catch (e) {
      return { ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Ошибки площадки: `{"COURSE_NOT_FOUND": "api.error.COURSE_NOT_FOUND"}` — код в ключе объекта. */
  private apiErrorCode(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const key = Object.keys(body as Record<string, unknown>)[0];
    return key && /^[A-Z_]+$/.test(key) ? key : null;
  }

  private guard(request: AccessRequest, token: string): ConnectorResult | null {
    if (!token) return { code: 'fatal', message: 'Skillspace не настроен: укажите API-ключ школы', error_code: 'NOT_CONFIGURED' };
    if (request.recipient.type !== EduRecipientType.EMAIL) {
      return { code: 'fatal', message: 'Skillspace принимает только почту обучающегося', error_code: 'UNSUPPORTED_RECIPIENT' };
    }
    if (!splitSkillspaceRef(request.course_ref).course) {
      return { code: 'fatal', message: 'У курса не задан идентификатор курса Skillspace', error_code: 'NO_COURSE_REF' };
    }
    return null;
  }

  async grant(request: AccessRequest): Promise<ConnectorResult> {
    const token = await this.token(request.coopname);
    const blocked = this.guard(request, token);
    if (blocked) return blocked;
    const { course, group } = splitSkillspaceRef(request.course_ref);
    const body = new URLSearchParams({ token, email: request.recipient.value });
    body.append(`courses[${course}]`, group);
    return this.post('/course/student-invite', body);
  }

  async revoke(request: AccessRequest): Promise<ConnectorResult> {
    const token = await this.token(request.coopname);
    const blocked = this.guard(request, token);
    if (blocked) return blocked;
    const { course } = splitSkillspaceRef(request.course_ref);
    const result = await this.post(`/course/${encodeURIComponent(course)}/student-remove`, new URLSearchParams({ token, email: request.recipient.value }));
    // Удаление идемпотентно (проверено: повторный remove — 200), но если курс
    // уже удалён в школе — отзывать нечего, цель достигнута.
    if (result.code === 'fatal' && result.error_code === 'COURSE_NOT_FOUND') return { code: 'exists', message: 'Курса уже нет в школе' };
    return result;
  }

  /** Сверка по реестрам школы: курс существует (и как называется), группа принадлежит курсу. */
  async check(coopname: string, courseRef: string): Promise<CourseCheckResult> {
    const token = await this.token(coopname);
    if (!token) return { found: false, unavailable: true, message: 'Skillspace не настроен' };
    const { course, group } = splitSkillspaceRef(courseRef);
    if (!course) return { found: false, message: 'У курса не задан идентификатор курса Skillspace' };

    const courses = await this.getJson<SkillspaceCourse[]>(`/school/course/list?token=${encodeURIComponent(token)}`);
    if (!courses.ok) return { found: false, unavailable: true, message: courses.message };
    const found = (Array.isArray(courses.data) ? courses.data : []).find((c) => c.id === course);
    if (!found) {
      return { found: false, message: `В школе Skillspace нет курса с идентификатором ${course} — выберите курс из списка школы в карточке курса` };
    }

    if (group) {
      const groupCheck = await this.checkGroup(token, course, group);
      if (groupCheck) return groupCheck;
    }
    return { found: true, title: found.name };
  }

  /** Группа должна существовать и принадлежать курсу; `null` — всё сходится. */
  private async checkGroup(token: string, course: string, group: string): Promise<CourseCheckResult | null> {
    const groups = await this.getJson<SkillspaceGroup[]>(`/school/group/list?token=${encodeURIComponent(token)}`);
    if (!groups.ok) return { found: false, unavailable: true, message: groups.message };
    const g = (Array.isArray(groups.data) ? groups.data : []).find((x) => x.id === group);
    if (!g) return { found: false, message: `Группа ${group} не найдена в школе Skillspace` };
    if (g.courseId !== course) return { found: false, message: `Группа «${g.name}» принадлежит другому курсу` };
    return null;
  }

  /** Реестр курсов школы — из него конструктор курса выбирает привязку. Только чтение. */
  async listCourses(coopname: string): Promise<SkillspaceCourse[]> {
    const res = await this.getJson<SkillspaceCourse[]>(`/school/course/list?token=${encodeURIComponent(await this.token(coopname))}`);
    return res.ok && Array.isArray(res.data) ? res.data : [];
  }

  /** Реестр групп школы (с принадлежностью курсу). Только чтение. */
  async listGroups(coopname: string): Promise<SkillspaceGroup[]> {
    const res = await this.getJson<SkillspaceGroup[]>(`/school/group/list?token=${encodeURIComponent(await this.token(coopname))}`);
    return res.ok && Array.isArray(res.data) ? res.data : [];
  }
}
