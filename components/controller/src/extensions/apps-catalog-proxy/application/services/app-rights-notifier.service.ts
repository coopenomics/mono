import { Inject, Injectable, Logger } from '@nestjs/common';
import { catalogAppTitle, platformSettings } from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, NOTIFICATION_PORT, type IAccountPort, type INotificationPort } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';

/**
 * Уведомление председателю о запросе новых прав ядра (487-37).
 *
 * Обновление с новым правом узел не ставит, пока председатель не ответит;
 * без уведомления он узнал бы о запросе, только открыв страницу приложения.
 * Отказ отправки запрос не роняет: запрос стоит на странице приложения и в
 * списке «Установленные».
 */
@Injectable()
export class AppRightsNotifierService {
  private readonly logger = new Logger(AppRightsNotifierService.name);

  constructor(
    @Inject(ACCOUNT_PORT) private readonly account: IAccountPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
  ) {}

  /** Приложение просит права сверх согласия: председатель получает уведомление со ссылкой на страницу приложения. */
  async requestRaised(packageId: string): Promise<void> {
    try {
      const { coopname, frontendUrl } = platformSettings();
      const chairmen = await this.account.getAccounts({ role: 'chairman' }, { page: 1, limit: 1, sortOrder: 'ASC' });
      const chairman = chairmen.items?.[0];
      if (!chairman) {
        this.logger.warn(`запрос прав ${packageId}: председатель не найден, уведомление не отправлено`);
        return;
      }
      const payload: Workflows.AppRightsRequested.IPayload = {
        coopShortName: await this.account.getDisplayName(coopname).catch(() => coopname),
        appTitle: catalogAppTitle(packageId),
        appUrl: `${frontendUrl}/${coopname}/apps/app/${encodeURIComponent(packageId)}`,
      };
      await this.notifications.notifyUser(chairman.username, Workflows.AppRightsRequested.id, payload);
      this.logger.log(`запрос прав ${packageId}: уведомление председателю ${chairman.username} отправлено`);
    } catch (e) {
      this.logger.warn(`запрос прав ${packageId}: уведомление не отправлено: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
