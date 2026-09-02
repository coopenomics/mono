/**
 * Объявление допуска кооперативов оператором сети (story 7.6, FR-E6).
 *
 * Юридическая половина подключения. Рычаг одобрения остаётся в ВОСХОДе: кооператив
 * активируется процессом `reg.coop` главной цепи, и по записи цепи об активации
 * (`registrator::stcoopstatus → active`) оператор объявляет card.coop допуск — имя и
 * наименование. Больше оператор ничего не знает, и больше объявление не несёт: параметры
 * установки кооператив донесёт сам.
 *
 * Активацию кооператива недоступность card.coop не блокирует (критерий приёмки): исход
 * доставки пишется в журнал, недоставленные объявления повторяются на старте. Там же
 * оператор объявляет допуск самому себе — событие активации у него не наступает.
 *
 * Включается настройкой «Я — оператор сети»: событие цепи видит каждая установка, а
 * объявлять допуск вправе только оператор — у остальных card.coop объявление и не примет.
 */
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistratorContract } from 'cooptypes';
import {
  CHAIN_PORT,
  type IChainPort,
  type InnerChainActionRecord,
  LOGGER_PORT,
  type ILoggerPort,
} from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { CardcoopExtension } from '../cardcoop.extension';
import { CardcoopAttestationService } from '../attestation/attestation.service';
import { CardcoopOperatorAnnouncementTypeormEntity } from '../infrastructure/entities/cardcoop-operator-announcement.typeorm-entity';
import { CardcoopRegistryDocumentType, NETWORK_OPERATOR_COOPNAME, type CardcoopAdmissionPayload } from './registry.types';

const CONTRACT = RegistratorContract.contractName.production;

/** Статусы кооператива в контракте регистратора (`registrator::stcoopstatus`). */
enum ChainCoopStatus {
  /** Кооператив активирован — единственный статус, порождающий объявление допуска. */
  Active = 'active',
  Blocked = 'blocked',
  Pending = 'pending',
}

@Injectable()
export class CardcoopOperatorAnnounceService {
  constructor(
    @InjectRepository(CardcoopOperatorAnnouncementTypeormEntity)
    private readonly announcements: Repository<CardcoopOperatorAnnouncementTypeormEntity>,
    private readonly extension: CardcoopExtension,
    private readonly attestationService: CardcoopAttestationService,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopOperatorAnnounceService.name);
  }

  /**
   * Кооператив активирован в цепи — объявляем допуск, если мы оператор сети.
   *
   * Блокировка (`blocked`) допуска не отзывает намеренно: приостановка участия в сети —
   * решение оператора АНО в card.coop, и подменять его автоматикой значило бы завести два
   * рычага для одного решения.
   */
  @OnEvent(`action::${CONTRACT}::${RegistratorContract.Actions.SetCoopStatus.actionName}`)
  async handleCoopStatus(actionData: InnerChainActionRecord): Promise<void> {
    const action = actionData.data as { coopname?: string; status?: ChainCoopStatus };
    if (!this.isOperator()) return;
    if (!action.coopname || action.status !== ChainCoopStatus.Active) return;

    try {
      await this.announce(action.coopname);
    } catch (error) {
      this.logger.error(
        `Допуск кооператива ${action.coopname} не объявлен: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Повторяет недоставленные объявления.
   *
   * Вызывается расширением после инициализации: card.coop мог лежать в момент активации, и
   * без повтора кооператив завис бы между «принят в цепи» и «допущен в сеть» до ручного
   * вмешательства.
   */
  async resendUndelivered(): Promise<void> {
    if (!this.isOperator()) return;

    await this.announceSelf();

    const pending = await this.announcements.find({ where: { delivered: false } });
    for (const record of pending) {
      try {
        await this.announce(record.coopname);
      } catch (error) {
        this.logger.error(
          `Повтор объявления о ${record.coopname} не удался: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Объявляет допуск самого оператора.
   *
   * Оператор — тоже кооператив сети, и своё подключение сеть без допуска не примет. Но
   * события активации у него не бывает: кооператив, заведённый при загрузке цепи, минует
   * `stcoopstatus`, и ждать его — значит ждать вечно (стенд 02.09.2026: подключение
   * отвергалось «не допущен оператором», пока запись не завели руками). Объявляется один
   * раз: доставленное повторно не отправляется.
   */
  /**
   * Эта установка — оператор сети: по имени кооператива либо по флагу в настройках.
   *
   * Имя главнее флага: оператор один, и требовать от него ставить галочку значило бы
   * держать в настройках поле, которое всем прочим включать нельзя. Флаг остаётся для
   * тестового контура, где оператором назначают другой кооператив.
   */
  private isOperator(): boolean {
    return this.extension.config.announce_as_operator || platformSettings().coopname === NETWORK_OPERATOR_COOPNAME;
  }

  private async announceSelf(): Promise<void> {
    const own = platformSettings().coopname;
    const known = await this.announcements.findOne({ where: { coopname: own } });
    if (known?.delivered) return;
    try {
      await this.announce(own);
    } catch (error) {
      this.logger.error(
        `Допуск самого оператора ${own} не объявлен: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Составляет, подписывает и отправляет объявление допуска; исход пишет в журнал.
   *
   * @param subject — кооператив, о допуске которого объявляется.
   */
  private async announce(subject: string): Promise<void> {
    const payload: CardcoopAdmissionPayload = {
      type: CardcoopRegistryDocumentType.Admission,
      coopname: platformSettings().coopname,
      subject,
      display_name: await this.displayName(subject),
      issued_at: new Date().toISOString(),
      chain_id: platformSettings().blockchain.chainId,
    };

    const envelope = await this.attestationService.signDocument(payload);
    const result = await this.attestationService.deliverDocument(
      `${this.extension.config.api_url.replace(/\/+$/, '')}/v1/registrar/announce`,
      envelope
    );

    const known = await this.announcements.findOne({ where: { coopname: subject } });
    const record = known ?? this.announcements.create({ coopname: subject });
    record.displayName = payload.display_name;
    record.delivered = result.delivered;
    record.lastError = result.delivered ? null : (result.reason ?? 'сеть недоступна');
    await this.announcements.save(record);

    if (result.delivered) {
      this.logger.info(`Допуск кооператива ${subject} объявлен сети карт`);
    } else {
      this.logger.error(`Объявление о ${subject} не доставлено: ${record.lastError}`);
    }
  }

  /**
   * Наименование кооператива из записи цепи.
   *
   * Из цепи, а не из чего-либо ещё: активацию записала цепь, и наименование должно быть тем,
   * под которым кооператив в ней зарегистрирован. Пустое поле не роняет объявление —
   * наименование уточнит контур АНО, а вот задержанный допуск остановил бы подключение.
   *
   * @param subject — системное имя кооператива.
   * @returns Наименование либо само имя, если запись не прочиталась.
   */
  private async displayName(subject: string): Promise<string> {
    try {
      const row = await this.chain.getSingleRow<{ announce?: string }>(CONTRACT, CONTRACT, 'coops', subject);
      const announce = row?.announce?.trim();
      return announce || subject;
    } catch {
      return subject;
    }
  }
}
