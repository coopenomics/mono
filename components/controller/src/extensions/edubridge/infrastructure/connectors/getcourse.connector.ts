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
 * GetCourse: открытый API `https://<account>.getcourse.ru/pl/api/users`
 * (POST, `action=add`, `params` = base64(JSON), `key` = API-ключ аккаунта).
 * Доступ к курсу — через добавление пользователя в группу (`user.group_name`
 * = `course_ref`); на стороне GetCourse группа открывает тренинг процессом.
 *
 * Отзыв: публичного удаления из группы у GetCourse нет — пользователь
 * добавляется в группу-сигнал `<course_ref>:revoked`, а процесс на стороне
 * площадки снимает доступ. Это договорённость с владельцем площадки, она
 * описана в INSTALL.md расширения.
 *
 * Проверка курса: у API нет чтения групп — `check` подтверждает доступность
 * аккаунта (запрос с пустым действием) и не может обнаружить переименование.
 */
@Injectable()
export class GetCourseConnector implements AccessCarrierConnector {
  readonly carrier = EduAccessCarrier.GETCOURSE;

  constructor(private readonly config: EdubridgeConfigHolder) {}

  private settings(): { account: string; key: string } {
    const c = this.config.get().connectors;
    return { account: c.getcourse_account, key: c.getcourse_api_key };
  }

  private async addToGroup(request: AccessRequest, group: string): Promise<ConnectorResult> {
    const { account, key } = this.settings();
    if (!account || !key) return { code: 'fatal', message: 'GetCourse не настроен: укажите аккаунт и API-ключ', error_code: 'NOT_CONFIGURED' };
    if (request.recipient.type !== EduRecipientType.EMAIL) {
      return { code: 'fatal', message: 'GetCourse принимает только почту обучающегося', error_code: 'UNSUPPORTED_RECIPIENT' };
    }
    const params = Buffer.from(
      JSON.stringify({
        user: { email: request.recipient.value, group_name: [group] },
        system: { refresh_if_exists: 1, partner_email: undefined },
        session: { utm_source: 'coopenomics', utm_medium: 'edubridge', utm_campaign: request.enrollment_id },
      })
    ).toString('base64');
    const body = new URLSearchParams({ action: 'add', key, params });
    try {
      const res = await httpCall(`https://${account}.getcourse.ru/pl/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) return classifyStatus(res.status, res.text);
      const data = (res.body ?? {}) as { success?: boolean; error?: boolean; error_message?: string; result?: { success?: boolean; error_message?: string } };
      const success = data.success === true || data.result?.success === true;
      if (success) return { code: 'ok' };
      const message = data.error_message ?? data.result?.error_message ?? res.text.slice(0, 200);
      if (/limit|лимит/i.test(message)) return { code: 'fatal', message, error_code: 'LICENSE_LIMIT' };
      return { code: 'retryable', message };
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

  async check(_coopname: string, courseRef: string): Promise<CourseCheckResult> {
    const { account, key } = this.settings();
    if (!account || !key) return { found: false, unavailable: true, message: 'GetCourse не настроен' };
    try {
      const res = await httpCall(`https://${account}.getcourse.ru/pl/api/account/groups?key=${encodeURIComponent(key)}`, { method: 'GET' });
      if (!res.ok) return { found: false, unavailable: true, message: `HTTP ${res.status}` };
      const groups = ((res.body as { info?: { items?: Array<{ id: number; name: string }> } })?.info?.items ?? []) as Array<{ id: number; name: string }>;
      const group = groups.find((g) => g.name === courseRef || String(g.id) === courseRef);
      return group ? { found: true, title: group.name } : { found: false, message: 'Группа не найдена в аккаунте GetCourse' };
    } catch (e) {
      return { found: false, unavailable: true, message: e instanceof Error ? e.message : String(e) };
    }
  }
}
