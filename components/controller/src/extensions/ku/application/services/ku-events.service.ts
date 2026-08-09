import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BranchContract } from 'cooptypes';
import { randomUUID } from 'crypto';
import { Workflows } from '@coopenomics/notifications';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { ACCOUNT_DATA_PORT, type AccountDataPort } from '~/domain/account/ports/account-data.port';
import { ORGANIZATION_REPOSITORY, type OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { INDIVIDUAL_REPOSITORY, type IndividualRepository } from '~/domain/common/repositories/individual.repository';
import {
  PAYMENT_METHOD_REPOSITORY,
  type PaymentMethodRepository,
} from '~/domain/common/repositories/payment-method.repository';
import { IndividualDomainEntity } from '~/domain/branch/entities/individual-domain.entity';
import { OrganizationDomainEntity } from '~/domain/branch/entities/organization-domain.entity';
import { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { platformSettings } from '@coopenomics/extension-kit';
import { BRANCH_BLOCKCHAIN_PORT, type BranchBlockchainPort } from '~/domain/branch/interfaces/branch-blockchain.port';
import { KU_DECISION_REPOSITORY, type KuDecisionRepository } from '../../domain/repositories/ku-decision.repository';
import {
  KU_TRUST_REQUEST_REPOSITORY,
  type KuTrustRequestRepository,
} from '../../domain/repositories/ku-trust-request.repository';

/**
 * Событийные реакции собраний кооперативных участков:
 * — старт голосования (branch::startdec) → уведомления всем участникам собрания;
 * — утверждение советом (branch::confirmdec) → создание карточки организации
 *   участка в БД (человекочитаемое наименование и адрес — приватные данные,
 *   которых нет в блокчейне), по образцу core-создания КУ со стола председателя.
 */
@Injectable()
export class KuEventsService {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT) private readonly accountPort: AccountDataPort,
    @Inject(KU_DECISION_REPOSITORY) private readonly decisionRepository: KuDecisionRepository,
    @Inject(KU_TRUST_REQUEST_REPOSITORY) private readonly trustRequestRepository: KuTrustRequestRepository,
    @Inject(BRANCH_BLOCKCHAIN_PORT) private readonly branchBlockchainPort: BranchBlockchainPort,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(INDIVIDUAL_REPOSITORY) private readonly individualRepository: IndividualRepository,
    @Inject(PAYMENT_METHOD_REPOSITORY) private readonly paymentMethodRepository: PaymentMethodRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(KuEventsService.name);
  }

  @OnEvent(`action::${BranchContract.contractName.production}::startdec`)
  async handleVotingStarted(actionData: ActionDomainInterface): Promise<void> {
    try {
      const action = actionData.data as { coopname: string; hash: string };
      if (action.coopname !== platformSettings().coopname) return;

      const decision = await this.decisionRepository.findByHash(action.hash);
      if (!decision) {
        this.logger.warn(`startdec: решение ${action.hash} не найдено в проекции — уведомления не отправлены`);
        return;
      }

      const coopShortName = await this.accountPort.getDisplayName(action.coopname).catch(() => action.coopname);
      const closeAtTime = decision.close_at
        ? new Date(decision.close_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
        : '';

      const payload: Workflows.BranchVotingStarted.IPayload = {
        coopShortName,
        meetPlace: decision.meet_place || '',
        closeAtTime,
        meetingUrl: `${platformSettings().frontendUrl}/${action.coopname}/ku/meetings/${decision.hash}`,
      };

      let sent = 0;
      for (const username of decision.participants ?? []) {
        try {
          const account = await this.accountPort.getAccount(username);
          const subscriberId = account.provider_account?.subscriber_id?.trim();
          const email = account.provider_account?.email;
          if (!subscriberId || !email) continue;

          await this.notificationPort.notify({
            coopname: action.coopname,
            workflowId: Workflows.BranchVotingStarted.id,
            to: { subscriberId, email, username },
            payload,
          });
          sent++;
        } catch (error: any) {
          this.logger.warn(`startdec: не удалось уведомить участника ${username}: ${error.message}`);
        }
      }
      this.logger.log(`startdec ${action.hash}: уведомлено ${sent}/${decision.participants?.length ?? 0} участников`);
    } catch (error: any) {
      this.logger.error(`Ошибка обработки startdec: ${error.message}`, error.stack);
    }
  }

  /** Уведомление одному пайщику; молча пропускает аккаунты без подписки на уведомления */
  private async notifyUser(username: string, workflowId: string, payload: Record<string, unknown>): Promise<boolean> {
    const account = await this.accountPort.getAccount(username);
    const subscriberId = account.provider_account?.subscriber_id?.trim();
    const email = account.provider_account?.email;
    if (!subscriberId || !email) return false;

    await this.notificationPort.notify({
      coopname: platformSettings().coopname,
      workflowId,
      to: { subscriberId, email, username },
      payload,
    });
    return true;
  }

  /** Напоминание участникам за час до начала собрания (если время назначено) */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async remindUpcomingMeetings(): Promise<void> {
    try {
      const now = Date.now();
      const from = new Date(now);
      const to = new Date(now + 65 * 60 * 1000);
      const meetings = await this.decisionRepository.findMeetingsForReminder(from, to);

      for (const meeting of meetings) {
        // окно [now, now+65m): шлём, когда до начала остался час или меньше
        const coopShortName = await this.accountPort.getDisplayName(platformSettings().coopname).catch(() => platformSettings().coopname);
        const payload: Workflows.BranchMeetingReminder.IPayload = {
          coopShortName,
          meetPlace: meeting.meet_place || '',
          meetAtTime: meeting.meet_at
            ? new Date(meeting.meet_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
            : '',
          meetingUrl: `${platformSettings().frontendUrl}/${platformSettings().coopname}/ku/meetings/${meeting.hash}`,
        };

        let sent = 0;
        for (const username of meeting.participants ?? []) {
          try {
            if (await this.notifyUser(username, Workflows.BranchMeetingReminder.id, payload)) sent++;
          } catch (error: any) {
            this.logger.warn(`напоминание о собрании ${meeting.hash}: не удалось уведомить ${username}: ${error.message}`);
          }
        }
        await this.decisionRepository.markReminderSent(meeting.hash as string);
        this.logger.log(`напоминание о собрании ${meeting.hash}: уведомлено ${sent}/${meeting.participants?.length ?? 0}`);
      }
    } catch (error: any) {
      this.logger.error(`Ошибка напоминаний о собраниях участков: ${error.message}`, error.stack);
    }
  }

  /** Новая заявка доверенного → уведомление председателю участка */
  @OnEvent(`action::${BranchContract.contractName.production}::reqtrusted`)
  async handleTrustedRequested(actionData: ActionDomainInterface): Promise<void> {
    try {
      const action = actionData.data as { coopname: string; braname: string; username: string; hash: string };
      if (action.coopname !== platformSettings().coopname) return;

      const branch = await this.branchBlockchainPort.getBranch(action.coopname, action.braname);
      if (!branch?.trustee) {
        this.logger.warn(`reqtrusted: участок ${action.braname} не найден — председатель не уведомлён`);
        return;
      }

      const coopShortName = await this.accountPort.getDisplayName(action.coopname).catch(() => action.coopname);
      const applicantName = await this.accountPort.getDisplayName(action.username).catch(() => action.username);
      const payload: Workflows.BranchTrustedRequested.IPayload = {
        coopShortName,
        applicantName,
        branchUrl: `${platformSettings().frontendUrl}/${action.coopname}/ku/branches/${action.braname}`,
      };

      await this.notifyUser(branch.trustee, Workflows.BranchTrustedRequested.id, payload);
      this.logger.log(`reqtrusted ${action.hash}: председатель ${branch.trustee} уведомлён о заявке ${action.username}`);
    } catch (error: any) {
      this.logger.error(`Ошибка обработки reqtrusted: ${error.message}`, error.stack);
    }
  }

  @OnEvent(`action::${BranchContract.contractName.production}::apprtrusted`)
  async handleTrustedApproved(actionData: ActionDomainInterface): Promise<void> {
    await this.notifyTrustedResolved(actionData, 'одобрена');
  }

  @OnEvent(`action::${BranchContract.contractName.production}::decltrusted`)
  async handleTrustedDeclined(actionData: ActionDomainInterface): Promise<void> {
    await this.notifyTrustedResolved(actionData, 'отклонена');
  }

  /** Решение председателя по заявке доверенного → уведомление заявителю */
  private async notifyTrustedResolved(actionData: ActionDomainInterface, resolution: string): Promise<void> {
    try {
      const action = actionData.data as { coopname: string; hash: string };
      if (action.coopname !== platformSettings().coopname) return;

      const request = await this.trustRequestRepository.findByHash(action.hash);
      if (!request?.username) {
        this.logger.warn(`заявка доверенного ${action.hash} не найдена в проекции — заявитель не уведомлён`);
        return;
      }

      const coopShortName = await this.accountPort.getDisplayName(action.coopname).catch(() => action.coopname);
      const payload: Workflows.BranchTrustedResolved.IPayload = {
        coopShortName,
        resolution,
        branchUrl: `${platformSettings().frontendUrl}/${action.coopname}/ku/branches/${request.braname}`,
      };

      await this.notifyUser(request.username, Workflows.BranchTrustedResolved.id, payload);
      this.logger.log(`заявка доверенного ${action.hash} ${resolution}: заявитель ${request.username} уведомлён`);
    } catch (error: any) {
      this.logger.error(`Ошибка уведомления о решении по заявке доверенного: ${error.message}`, error.stack);
    }
  }

  @OnEvent(`action::${BranchContract.contractName.production}::confirmdec`)
  async handleBranchEstablished(actionData: ActionDomainInterface): Promise<void> {
    try {
      const action = actionData.data as { coopname: string; hash: string };
      if (action.coopname !== platformSettings().coopname) return;

      const decision = await this.decisionRepository.findByHash(action.hash);
      if (!decision?.braname || !decision.chairman) {
        this.logger.warn(`confirmdec: решение ${action.hash} не найдено в проекции — карточка участка не создана`);
        return;
      }

      const existing = await this.organizationRepository.findByUsername(decision.braname).catch(() => null);
      if (existing) return; // идемпотентность при повторной доставке события

      const cooperative = await this.organizationRepository.findByUsername(action.coopname);
      if (!cooperative) {
        this.logger.error(`confirmdec: организация кооператива ${action.coopname} не найдена`);
        return;
      }

      const trustee = new IndividualDomainEntity(await this.individualRepository.findByUsername(decision.chairman));
      const branchName = decision.branch_name || decision.braname;

      const combinedData = new OrganizationDomainEntity({
        ...cooperative,
        short_name: `КУ «${branchName}»`,
        full_name: `Кооперативный Участок «${branchName}»`,
        fact_address: decision.address || '',
        represented_by: {
          first_name: trustee.first_name,
          last_name: trustee.last_name,
          middle_name: trustee.middle_name,
          based_on: `Протокол собрания пайщиков кооперативного участка от ${new Date().toLocaleDateString('ru-RU')}`,
          position: 'председатель кооперативного участка',
        },
        username: decision.braname,
      });

      await this.organizationRepository.create(combinedData);

      const cooperativeBank = await this.paymentMethodRepository.get({
        username: action.coopname,
        method_type: 'bank_transfer',
        is_default: true,
      });

      await this.paymentMethodRepository.save(
        new PaymentMethodDomainEntity({
          username: decision.braname,
          method_id: randomUUID().toString(),
          method_type: 'bank_transfer',
          data: cooperativeBank.data,
          is_default: true,
        })
      );

      this.logger.log(`confirmdec ${action.hash}: создана карточка участка ${decision.braname} («${branchName}»)`);
    } catch (error: any) {
      this.logger.error(`Ошибка обработки confirmdec: ${error.message}`, error.stack);
    }
  }
}
