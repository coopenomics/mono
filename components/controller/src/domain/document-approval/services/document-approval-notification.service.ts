import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { DraftContract } from 'cooptypes';
import { Workflows } from '@coopenomics/notifications';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  ACCOUNT_PORT,
  COOPERATIVE_VARS_PORT,
  NOTIFICATION_PORT,
  type IAccountPort,
  type ICooperativeVarsPort,
  type INotificationPort,
  type InnerNotifyRecipient,
} from '@coopenomics/innercoop';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { DOCUMENT_DECLARATION_QUERY_PORT, type DocumentDeclarationQueryPort } from '../ports/document-declaration-query.port';
import { DocumentApprovalRequirement, DocumentApprovalState } from '../enums/document-approval.enums';
import type { DocumentTemplateView } from '../interfaces/document-template-view.interface';
import { DocumentApprovalStateService } from './document-approval-state.service';
import { DOCUMENT_APPROVAL_DECLINED_EVENT, type DocumentApprovalDeclinedPayload } from './document-approval-proposal.service';

interface CoopNames {
  short_abbr: string;
  name: string;
}

/**
 * Уведомления фабрики утверждений председателю.
 *
 * Вкладка «Шаблоны документов» нужна редко, и о ней забудут; о новой редакции,
 * отклонённом решении и о документах, зависших без утверждения, председатель
 * узнаёт сам, а не от пайщиков. Получатель — председатель кооператива, адрес
 * берётся из реестра аккаунтов, как в остальных уведомлениях совета.
 */
@Injectable()
export class DocumentApprovalNotificationService {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: INotificationPort,
    @Inject(ACCOUNT_PORT)
    private readonly accounts: IAccountPort,
    @Inject(COOPERATIVE_VARS_PORT)
    private readonly vars: ICooperativeVarsPort,
    @Inject(DOCUMENT_DECLARATION_QUERY_PORT)
    private readonly declarations: DocumentDeclarationQueryPort,
    private readonly state: DocumentApprovalStateService,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(DocumentApprovalNotificationService.name);
  }

  /**
   * Оператор поднял редакцию шаблона в сети. Если документ объявлен в
   * кооперативе и требует утверждения — председателю нужно вынести его на совет.
   */
  @OnEvent(`action::${DraftContract.contractName.production}::${DraftContract.Actions.UpVersion.actionName}`)
  async handleUpVersion(action: ActionDomainInterface): Promise<void> {
    const data = action.data as { scope?: string; registry_id?: string | number } | undefined;
    if (String(data?.scope) !== DraftContract.contractName.production) return;

    const registry_id = Number(data?.registry_id);
    const declaration = this.declarations.getByRegistryId(registry_id);
    if (!declaration || declaration.approval !== 'required') return;

    try {
      const template = (await this.state.getTemplates(config.coopname)).find((t) => t.registry_id === registry_id);
      if (!template) return;

      await this.notifyChairman(Workflows.DocumentEditionAvailable.id, (userName, names) => ({
        userName,
        documentTitle: template.title,
        version: String(template.current_version ?? ''),
        coopname: config.coopname,
        ...names,
        templatesUrl: this.templatesUrl(),
      }));
    } catch (error) {
      this.logger.error(`Не удалось уведомить о новой редакции документа ${registry_id}: ${errorMessage(error)}`);
    }
  }

  /** Совет отклонил утверждение или не рассмотрел его в срок. */
  @OnEvent(DOCUMENT_APPROVAL_DECLINED_EVENT)
  async handleDeclined(payload: DocumentApprovalDeclinedPayload): Promise<void> {
    try {
      const templates = await this.state.getTemplates(config.coopname);
      const titles = payload.registry_ids
        .map((id) => templates.find((t) => t.registry_id === id)?.title ?? `документ ${id}`)
        .map((title) => `«${title}»`)
        .join(', ');

      await this.notifyChairman(Workflows.DocumentApprovalDeclined.id, (userName, names) => ({
        userName,
        documentTitles: titles,
        decision_id: String(payload.decision_id),
        reasonText: payload.reason === 'declined' ? 'отклонено советом' : 'снято как не рассмотренное в срок',
        coopname: config.coopname,
        ...names,
        templatesUrl: this.templatesUrl(),
      }));
    } catch (error) {
      this.logger.error(`Не удалось уведомить об отклонении утверждения: ${errorMessage(error)}`);
    }
  }

  /** Периодическое напоминание о документах без утверждённой редакции. */
  @Cron(config.document_approval.reminder_cron)
  async remindAboutOutdated(): Promise<void> {
    if (!config.document_approval.reminder_enabled) return;
    try {
      await this.sendReminder();
    } catch (error) {
      this.logger.error(`Не удалось отправить напоминание об утверждении документов: ${errorMessage(error)}`);
    }
  }

  /** Отправляет напоминание, если есть что напоминать; возвращает число документов. */
  async sendReminder(): Promise<number> {
    const waiting = (await this.state.getTemplates(config.coopname)).filter(needsCouncil);
    if (waiting.length === 0) return 0;

    await this.notifyChairman(Workflows.DocumentEditionReminder.id, (userName, names) => ({
      userName,
      count: String(waiting.length),
      documentTitles: waiting.map((t) => `«${t.title}»`).join(', '),
      coopname: config.coopname,
      ...names,
      templatesUrl: this.templatesUrl(),
    }));
    return waiting.length;
  }

  private async notifyChairman(
    workflowId: string,
    buildPayload: (userName: string, names: CoopNames) => Record<string, unknown>
  ): Promise<void> {
    const chairmen = await this.accounts.getAccounts({ role: 'chairman' }, { page: 1, limit: 1, sortOrder: 'ASC' });
    const chairman = chairmen.items?.[0];
    const subscriberId = chairman?.provider_account?.subscriber_id?.trim();
    if (!chairman || !subscriberId) {
      this.logger.warn('Председатель или его подписка на уведомления не найдены — уведомление не отправлено');
      return;
    }

    const recipient: InnerNotifyRecipient = {
      subscriberId,
      email: chairman.provider_account?.email ?? undefined,
      username: chairman.username,
    };
    const userName = await this.accounts.getDisplayName(chairman.username);
    const vars = await this.vars.get();
    const names: CoopNames = { short_abbr: vars?.shortAbbr ?? '', name: vars?.name ?? '' };

    await this.notifications.notify({
      coopname: config.coopname,
      workflowId,
      to: recipient,
      payload: buildPayload(userName, names),
    });
  }

  private templatesUrl(): string {
    return `${platformSettings().frontendUrl}/${config.coopname}/documents/templates`;
  }
}

/** Документ требует утверждения, и утверждённой текущей редакции у него нет. */
function needsCouncil(template: DocumentTemplateView): boolean {
  return (
    template.approval === DocumentApprovalRequirement.Required &&
    (template.state === DocumentApprovalState.Outdated || template.state === DocumentApprovalState.NotApproved)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
