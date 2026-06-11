import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BranchContract } from 'cooptypes';
import { randomUUID } from 'crypto';
import { Workflows } from '@coopenomics/notifications';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
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
import config from '~/config/config';
import { KU_DECISION_REPOSITORY, type KuDecisionRepository } from '../../domain/repositories/ku-decision.repository';

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
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(INDIVIDUAL_REPOSITORY) private readonly individualRepository: IndividualRepository,
    @Inject(PAYMENT_METHOD_REPOSITORY) private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(KuEventsService.name);
  }

  @OnEvent(`action::${BranchContract.contractName.production}::startdec`)
  async handleVotingStarted(actionData: ActionDomainInterface): Promise<void> {
    try {
      const action = actionData.data as { coopname: string; hash: string };
      if (action.coopname !== config.coopname) return;

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
        meetingUrl: `${config.frontend_url}/${action.coopname}/ku/meetings/${decision.hash}`,
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

  @OnEvent(`action::${BranchContract.contractName.production}::confirmdec`)
  async handleBranchEstablished(actionData: ActionDomainInterface): Promise<void> {
    try {
      const action = actionData.data as { coopname: string; hash: string };
      if (action.coopname !== config.coopname) return;

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
