import { Injectable } from '@nestjs/common';
import { EduAccessCarrier, EduRecipientType } from '../../domain/enums';
import type {
  AccessCarrierConnector,
  AccessRequest,
  ConnectorResult,
  ConnectorPingResult,
  CourseCheckResult,
} from '../../domain/connectors/access-carrier.connector';
import { Inject } from '@nestjs/common';
import { CONNECTOR_CREDENTIALS_SOURCE, type ConnectorCredentialField, type IConnectorCredentialsSource } from '../../domain/connectors/connector-credentials';
import { classifyHttpFailure, classifyStatus, httpCall } from './http-carrier.base';
import { t } from '../../i18n';

/**
 * GetCourse — официальный API (getcourse.ru/help/api):
 *  - импорт: POST https://<account>.getcourse.ru/pl/api/users
 *      action=add, key=<API-ключ>, params=base64(JSON{user:{email, group_name:[…]},
 *      system:{refresh_if_exists:1}, session:{utm_*}}); ответ
 *      {success, result:{user_id, error, error_message}}; «Limit reached» —
 *      исчерпана месячная квота тарифа;
 *  - экспорт: GET https://<account>.getcourse.ru/pl/api/account/groups?key=…
 *      ответ {success, info:[{id, name, last_added_at}]}; отказ приходит с
 *      HTTP 200: {success:false, error_message, error_code} (901 — ключ не
 *      принят). Лимит 100 экспорт-запросов за 2 часа — список групп держится
 *      в памяти несколько минут.
 * Адрес школы: имя аккаунта (`school` → school.getcourse.ru) либо её домен
 * целиком — API отвечает на обоих.
 * Доступ к тренингу — через группу (`user.group_name` = `course_ref`); группа
 * открывает тренинг процессом на стороне GetCourse.
 *
 * Отзыв: пользователь добавляется в группу-сигнал `<course_ref>:revoked`, а
 * процесс площадки снимает доступ (настраивает владелец школы, INSTALL.md).
 * Действие `update` у GetCourse заменяет ВЕСЬ состав групп пользователя: им
 * отзыв не делается — оно сняло бы ученика с чужих групп школы.
 */
interface GetcourseBody {
  success?: boolean;
  error?: boolean;
  error_message?: string;
  result?: { success?: boolean; error_message?: string };
}

/** Ответ GetCourse при HTTP 200: успех — в `success`, отказ — текстом в `error_message`. */
const GETCOURSE_FATAL: Array<[RegExp, string]> = [
  [/limit reached|лимит/i, 'LICENSE_LIMIT'],
  [/unauthorized/i, 'UNAUTHORIZED'],
  [/no email|empty action|forbidden/i, 'BAD_REQUEST'],
];

function classifyGetcourseBody(body: unknown, text: string): ConnectorResult {
  const data = (body ?? {}) as GetcourseBody;
  if (data.success === true || data.result?.success === true) return { code: 'ok' };
  const message = data.error_message ?? data.result?.error_message ?? text.slice(0, 200);
  const fatal = GETCOURSE_FATAL.find(([re]) => re.test(message));
  if (fatal) return { code: 'fatal', message: `GetCourse: ${message}`, error_code: fatal[1] };
  return { code: 'retryable', message };
}

/** Сколько список групп школы держится в памяти: экспорт GetCourse ограничен 100 запросами за 2 часа. */
const GROUPS_TTL_MS = 5 * 60 * 1000;

export interface GetcourseGroup {
  id: string;
  name: string;
}

/**
 * Хост школы из поля «аккаунт»: имя аккаунта даёт `<имя>.getcourse.ru`, домен
 * либо адрес целиком берётся как есть — без протокола и пути.
 */
export function getcourseHost(account: string): string {
  const host = account.trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').toLowerCase();
  return host.includes('.') ? host : `${host}.getcourse.ru`;
}

@Injectable()
export class GetCourseConnector implements AccessCarrierConnector {
  readonly carrier = EduAccessCarrier.GETCOURSE;

  readonly credentialFields: ConnectorCredentialField[] = [
    { key: 'account', label: t('edubridge.getcourseConnector.field.account.label'), secret: false, note: t('edubridge.getcourseConnector.field.account.note') },
    { key: 'api_key', label: t('edubridge.getcourseConnector.field.apiKey.label'), secret: true, note: t('edubridge.getcourseConnector.field.apiKey.note') },
  ];

  constructor(@Inject(CONNECTOR_CREDENTIALS_SOURCE) private readonly credentials: IConnectorCredentialsSource) {}

  /** Адрес API школы: из настроек расширения, по умолчанию — площадка GetCourse; `{account}` — аккаунт школы. */
  private async apiBase(account: string): Promise<string> {
    const template = await this.credentials.apiBase?.(this.carrier);
    if (!template) return `https://${getcourseHost(account)}`;
    // Обычный шаблон площадки: в поле может стоять уже готовый домен — окончание к нему не дописывается.
    return template.replace('{account}.getcourse.ru', getcourseHost(account)).replace('{account}', account.trim()).replace(/\/+$/, '');
  }

  private readonly groupsCache = new Map<string, { at: number; groups: GetcourseGroup[] }>();

  /**
   * Группы школы — только чтение. Отказ GetCourse приходит с HTTP 200, поэтому
   * успех определяет поле `success`, а не код ответа.
   */
  private async readGroups(coopname: string): Promise<{ ok: true; groups: GetcourseGroup[] } | { ok: false; message: string }> {
    const { account, key } = await this.settings(coopname);
    if (!account || !key) return { ok: false, message: t('edubridge.getcourseConnector.notConfigured') };
    const cached = this.groupsCache.get(coopname);
    if (cached && Date.now() - cached.at < GROUPS_TTL_MS) return { ok: true, groups: cached.groups };
    const base = await this.apiBase(account);
    try {
      const res = await httpCall(`${base}/pl/api/account/groups?key=${encodeURIComponent(key)}`, { method: 'GET' });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const body = (res.body ?? {}) as { success?: boolean; error_message?: string; info?: unknown };
      if (body.success !== true) return { ok: false, message: `GetCourse: ${body.error_message ?? res.text.slice(0, 200)}` };
      const groups = groupsOf(body.info);
      this.groupsCache.set(coopname, { at: Date.now(), groups });
      return { ok: true, groups };
    } catch (e) {
      return { ok: false, message: t('edubridge.getcourseConnector.unreachable', { host: base.replace(/^https?:\/\//, ''), message: failureOf(e) }) };
    }
  }

  /** Группы школы для выбора привязки курса; ключи не заданы либо школа не ответила — пусто. */
  async listGroups(coopname: string): Promise<GetcourseGroup[]> {
    const res = await this.readGroups(coopname);
    return res.ok ? res.groups : [];
  }

  private async settings(coopname: string): Promise<{ account: string; key: string }> {
    const c = await this.credentials.get(coopname, this.carrier);
    return { account: c.account ?? '', key: c.api_key ?? '' };
  }

  private async addToGroup(request: AccessRequest, group: string): Promise<ConnectorResult> {
    const { account, key } = await this.settings(request.coopname);
    if (!account || !key) return { code: 'fatal', message: t('edubridge.getcourseConnector.notConfiguredFull'), error_code: 'NOT_CONFIGURED' };
    if (request.recipient.type !== EduRecipientType.EMAIL) {
      return { code: 'fatal', message: t('edubridge.getcourseConnector.emailOnly'), error_code: 'UNSUPPORTED_RECIPIENT' };
    }
    const params = Buffer.from(
      JSON.stringify({
        user: { email: request.recipient.value, group_name: [group] },
        system: { refresh_if_exists: 1 },
        session: { utm_source: 'coopenomics', utm_medium: 'edubridge', utm_campaign: request.enrollment_id },
      })
    ).toString('base64');
    const body = new URLSearchParams({ action: 'add', key, params });
    try {
      const res = await httpCall(`${await this.apiBase(account)}/pl/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) return classifyStatus(res.status, res.text);
      return classifyGetcourseBody(res.body, res.text);
    } catch (e) {
      return classifyHttpFailure(e);
    }
  }

  grant(request: AccessRequest): Promise<ConnectorResult> {
    return this.addToGroup(request, request.course_ref);
  }

  revoke(request: AccessRequest): Promise<ConnectorResult> {
    return this.addToGroup(request, `${request.course_ref}:revoked`);
  }

  /** Подключение: ключ аккаунта принимается — список групп читается. */
  async ping(coopname: string): Promise<ConnectorPingResult> {
    this.groupsCache.delete(coopname);
    const res = await this.readGroups(coopname);
    return res.ok ? { ok: true, message: t('edubridge.getcourseConnector.pingOk', { count: res.groups.length }) } : { ok: false, message: res.message };
  }

  /**
   * Привязка курса — название группы школы: выдача передаёт его площадке как
   * название, поэтому номер группы привязкой не считается.
   */
  async check(coopname: string, courseRef: string): Promise<CourseCheckResult> {
    const res = await this.readGroups(coopname);
    if (!res.ok) return { found: false, unavailable: true, message: res.message };
    const group = res.groups.find((g) => g.name === courseRef);
    return group ? { found: true, title: group.name } : { found: false, message: t('edubridge.getcourseConnector.groupNotFound') };
  }
}

/** Список групп из ответа экспорта: массив в `info`; прежний вид `info.items` тоже читается. */
function groupsOf(info: unknown): GetcourseGroup[] {
  const items = Array.isArray(info) ? info : ((info as { items?: unknown[] } | null)?.items ?? []);
  return (items as Array<{ id?: unknown; name?: unknown }>).filter((g) => g && g.name).map((g) => ({ id: String(g.id ?? ''), name: String(g.name) }));
}

/** Причина сетевого сбоя словами: `fetch failed` сам по себе ничего не объясняет. */
function failureOf(e: unknown): string {
  const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
  const message = e instanceof Error ? e.message : String(e);
  return cause?.code ? `${message} (${cause.code})` : message;
}
