/**
 * Приём в пайщики: выпуск свидетельства по связке, ждавшей решения совета (story 7.5, FR-E5).
 *
 * Кандидат приходит со своей картой ещё на этапе вступления — и это ровно то, чего мы хотим:
 * карта у человека уже есть, а вторая обнулила бы накопленное (PRD 4.3). Но свидетельствовать
 * о членстве в тот момент нечего: совет ещё не решил, и в цепи нет даты приёма, на которую
 * документ обязан опираться.
 *
 * Поэтому связка ждёт, а выпуск происходит здесь — по записи цепи о приёме. Дата берётся из
 * самого действия: именно её потом проверяет третья сторона.
 */
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SovietContract } from 'cooptypes';
import type { InnerChainActionRecord } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { CardcoopExtension } from '../cardcoop.extension';
import { CardcoopMembershipService } from './membership.service';
import { chainDate } from './chain-date';

const CONTRACT = SovietContract.contractName.production;

/**
 * Действие цепи, которым человек становится пайщиком.
 *
 * Точка выбрана намеренно: и приём кандидата советом (`registrator::confirmreg`), и импорт
 * действующего пайщика оператором (`registrator::adduser`) заканчиваются одним и тем же
 * inline-действием — записью в реестр пайщиков. Слушать сами команды регистратора значило бы
 * перечислять пути приёма и однажды пропустить новый; у `confirmreg` вдобавок нет `username`
 * в данных — там только хэш регистрации. В `cooptypes` действие не объявлено — имя по цепи,
 * как у действий процесса выхода.
 */
const ADD_PARTICIPANT = 'addpartcpnt';

/** Приводит ошибку к строке для журнала. */
const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

@Injectable()
export class CardcoopJoinEventsService {
  constructor(
    private readonly membership: CardcoopMembershipService,
    private readonly extension: CardcoopExtension,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopJoinEventsService.name);
  }

  /**
   * Пайщик принят — выпускаем свидетельство, если он связывал карту при вступлении.
   *
   * Отсутствие ожидающей связки — норма и молчит: большинство принимаемых карту не
   * связывали, и шум в журнале на каждом приёме только мешал бы разбирать настоящие сбои.
   */
  @OnEvent(`action::${CONTRACT}::${ADD_PARTICIPANT}`)
  async handleMemberAdded(actionData: InnerChainActionRecord): Promise<void> {
    const action = actionData.data as { coopname?: string; username?: string; created_at?: string };
    if (!this.isOurs(action.coopname) || !action.username) return;

    try {
      await this.membership.issuePendingLink(
        this.extension.config.api_url,
        action.username,
        this.memberSince(action.created_at)
      );
    } catch (error) {
      // Промах здесь означает, что человек вступил, а его карта осталась без
      // подтверждённого членства. Разбирается по журналу: связка не потеряна, она ждёт.
      this.logger.error(`Не удалось выпустить свидетельство пайщику ${action.username}: ${describe(error)}`);
    }
  }

  /**
   * Дата приёма из действия цепи.
   *
   * Берётся из самого действия, а не из учётной записи: свидетельство обязано опираться на
   * то, что записала цепь. Если поля нет — сегодняшний день, потому что приём произошёл
   * прямо сейчас, и это ровно тот момент, о котором мы свидетельствуем.
   *
   * @param createdAt — момент приёма из действия (`time_point_sec`, без зоны — это UTC).
   * @returns Дата `YYYY-MM-DD`.
   */
  private memberSince(createdAt?: string): string {
    const fromChain = createdAt ? chainDate(createdAt) : null;
    return fromChain ?? new Date().toISOString().slice(0, 10);
  }

  /** Наш ли это кооператив: свидетельствовать о пайщике чужого мы не вправе. */
  private isOurs(coopname?: string): boolean {
    return Boolean(coopname) && coopname === platformSettings().coopname;
  }
}
