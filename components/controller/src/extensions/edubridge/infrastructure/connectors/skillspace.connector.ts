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
 * Ответы: 200 `{}`/пусто — успех; 400 — неверные данные; 401 — неверный ключ;
 * 403 — доступ запрещён; 405 — метод не поддерживается.
 *
 * `course_ref` курса — `<ID_КУРСА>` или `<ID_КУРСА>:<ID_ГРУППЫ>` (UUID).
 * Площадке передаётся только почта обучающегося; имя не передаём.
 */
const SKILLSPACE_API_BASE = 'https://skillspace.ru/api/open/v1';

export function splitSkillspaceRef(ref: string): { course: string; group: string } {
  const [course, group = ''] = ref.split(':');
  return { course: course?.trim() ?? '', group: group.trim() };
}

interface SkillspaceCourse {
  id: string;
  name: string;
  slug?: string;
}
interface SkillspaceGroup {
  id: string;
  courseId: string;
  name: string;
  studentsCount?: number;
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
      if (res.status === 403) return { code: 'fatal', message: 'Skillspace: доступ запрещён для этого ключа', error_code: 'FORBIDDEN' };
      if (res.status === 400) return { code: 'fatal', message: `Skillspace: неверные данные — ${res.text.slice(0, 200)}`, error_code: 'BAD_REQUEST' };
      return classifyStatus(res.status, res.text);
    } catch (e) {
      return classifyHttpFailure(e);
    }
  }

  private async getJson<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
    try {
      const res = await httpCall(`${SKILLSPACE_API_BASE}${path}`, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) return { ok: false, status: res.status, message: res.status === 401 ? 'Skillspace: неверный API-ключ школы' : `HTTP ${res.status}` };
      return { ok: true, data: res.body as T };
    } catch (e) {
      return { ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
    }
  }

  private guard(request: AccessRequest): ConnectorResult | null {
    if (!this.token()) return { code: 'fatal', message: 'Skillspace не настроен: укажите API-ключ школы', error_code: 'NOT_CONFIGURED' };
    if (request.recipient.type !== EduRecipientType.EMAIL) {
      return { code: 'fatal', message: 'Skillspace принимает только почту обучающегося', error_code: 'UNSUPPORTED_RECIPIENT' };
    }
    if (!splitSkillspaceRef(request.course_ref).course) {
      return { code: 'fatal', message: 'У курса не задан идентификатор курса Skillspace', error_code: 'NO_COURSE_REF' };
    }
    return null;
  }

  async grant(request: AccessRequest): Promise<ConnectorResult> {
    const blocked = this.guard(request);
    if (blocked) return blocked;
    const { course, group } = splitSkillspaceRef(request.course_ref);
    const body = new URLSearchParams({ token: this.token(), email: request.recipient.value });
    body.append(`courses[${course}]`, group);
    return this.post('/course/student-invite', body);
  }

  async revoke(request: AccessRequest): Promise<ConnectorResult> {
    const blocked = this.guard(request);
    if (blocked) return blocked;
    const { course } = splitSkillspaceRef(request.course_ref);
    const result = await this.post(`/course/${encodeURIComponent(course)}/student-remove`, new URLSearchParams({ token: this.token(), email: request.recipient.value }));
    // Ученика уже нет на курсе — площадка отвечает 400; для отзыва это достигнутая цель.
    if (result.code === 'fatal' && result.error_code === 'BAD_REQUEST') return { code: 'exists', message: 'Ученика уже нет на курсе' };
    return result;
  }

  /** Сверка по реестрам школы: курс существует (и как называется), группа принадлежит курсу. */
  async check(_coopname: string, courseRef: string): Promise<CourseCheckResult> {
    const token = this.token();
    if (!token) return { found: false, unavailable: true, message: 'Skillspace не настроен' };
    const { course, group } = splitSkillspaceRef(courseRef);
    if (!course) return { found: false, message: 'У курса не задан идентификатор курса Skillspace' };

    const courses = await this.getJson<SkillspaceCourse[]>(`/school/course/list?token=${encodeURIComponent(token)}`);
    if (!courses.ok) return { found: false, unavailable: true, message: courses.message };
    const found = (Array.isArray(courses.data) ? courses.data : []).find((c) => c.id === course);
    if (!found) return { found: false, message: 'Курс с таким идентификатором не найден в школе Skillspace' };

    if (group) {
      const groups = await this.getJson<SkillspaceGroup[]>(`/school/group/list?token=${encodeURIComponent(token)}`);
      if (!groups.ok) return { found: false, unavailable: true, message: groups.message };
      const g = (Array.isArray(groups.data) ? groups.data : []).find((x) => x.id === group);
      if (!g) return { found: false, message: `Группа ${group} не найдена в школе Skillspace` };
      if (g.courseId !== course) return { found: false, message: `Группа «${g.name}» принадлежит другому курсу` };
    }
    return { found: true, title: found.name };
  }

  /** Справочно для стола владельца: курсы школы. Только чтение. */
  async listCourses(): Promise<SkillspaceCourse[]> {
    const res = await this.getJson<SkillspaceCourse[]>(`/school/course/list?token=${encodeURIComponent(this.token())}`);
    return res.ok && Array.isArray(res.data) ? res.data : [];
  }
}
