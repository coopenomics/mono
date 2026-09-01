/**
 * GraphQL входа по карте и быстрой регистрации (story 9.2/9.3).
 *
 * Резолверы публичные намеренно: человек ещё не вошёл в стол — регистрироваться он и пришёл.
 * Право доступа к сессии — её идентификатор: случайный UUID, который знает только браузер,
 * вернувшийся из card.coop. Анкета вдобавок читается ровно один раз: повторный запрос — хоть
 * из истории браузера, хоть перебором — получает отказ.
 */
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CardcoopExtension } from '../cardcoop.extension';
import { CardcoopEntryService } from '../entry/entry.service';
import { CardcoopDisclosureIntakeService } from '../entry/disclosure-intake.service';
import type { CardcoopEntrySessionTypeormEntity } from '../infrastructure/entities/cardcoop-entry-session.typeorm-entity';
import {
  CardcoopEntryDTO,
  CardcoopEntryInputDTO,
  CardcoopEntryMembershipDTO,
  CardcoopEntryProfileDTO,
  CardcoopRequestEntryDisclosureInputDTO,
} from './dto/cardcoop-entry.dto';

@Resolver()
export class CardcoopEntryResolver {
  constructor(
    private readonly extension: CardcoopExtension,
    private readonly entry: CardcoopEntryService,
    private readonly intake: CardcoopDisclosureIntakeService
  ) {}

  /**
   * Доступен ли вход по карте пайщика в этом кооперативе.
   *
   * @returns `true`, когда кнопке входа есть куда вести.
   */
  @Query(() => Boolean, {
    name: 'cardcoopEntryAvailable',
    description: 'Доступен ли вход по карте пайщика в этом кооперативе',
  })
  async entryAvailable(): Promise<boolean> {
    return this.entry.available();
  }

  /**
   * Сессия входа по карте.
   *
   * @param data — идентификатор сессии.
   * @returns Состояние: кто вошёл и на каком шаге быстрая регистрация.
   */
  @Query(() => CardcoopEntryDTO, {
    name: 'cardcoopEntry',
    description: 'Сессия входа по карте пайщика: кто вошёл и на каком шаге быстрая регистрация',
  })
  async entrySession(@Args('data') data: CardcoopEntryInputDTO): Promise<CardcoopEntryDTO> {
    return this.toDto(await this.entry.session(data.entry_id));
  }

  /**
   * Просит card.coop спросить согласие держателя на перенос анкеты из выбранного кооператива.
   *
   * @param data — сессия и кооператив-источник.
   * @returns Сессия в состоянии ожидания решения держателя.
   */
  @Mutation(() => CardcoopEntryDTO, {
    name: 'cardcoopRequestEntryDisclosure',
    description: 'Запросить перенос анкеты из выбранного кооператива — решение принимает держатель на card.coop',
  })
  async requestDisclosure(@Args('data') data: CardcoopRequestEntryDisclosureInputDTO): Promise<CardcoopEntryDTO> {
    return this.toDto(
      await this.intake.requestDisclosure(this.extension.config.api_url, data.entry_id, data.from_coopname)
    );
  }

  /**
   * Забирает полученную анкету в форму вступления — ровно один раз.
   *
   * @param data — сессия входа.
   * @returns Вид субъекта и анкета.
   */
  @Mutation(() => CardcoopEntryProfileDTO, {
    name: 'cardcoopTakeEntryProfile',
    description: 'Забрать перенесённую анкету в форму вступления; повторного прочтения не существует',
  })
  async takeProfile(@Args('data') data: CardcoopEntryInputDTO): Promise<CardcoopEntryProfileDTO> {
    const { subjectType, profile } = await this.entry.takeProfile(data.entry_id);
    return { subjectType, profile };
  }

  /**
   * Приводит запись сессии к форме GraphQL.
   *
   * Адрес сети приезжает вместе с сессией намеренно: страница входа публичная, спросить его
   * отдельным запросом ей неоткуда, а без него человеку, ждущему согласия, некуда нажать —
   * кабинет карты открыт не был, он пришёл переходом (3B5-55).
   */
  private toDto(session: CardcoopEntrySessionTypeormEntity): CardcoopEntryDTO {
    return {
      id: session.id,
      outcome: session.outcome,
      status: session.status,
      cardNumber: session.cardNumber,
      username: session.username,
      memberships: session.memberships.map(
        (entry): CardcoopEntryMembershipDTO => ({
          coopname: String(entry.coopname ?? ''),
          displayName: String(entry.display_name ?? entry.coopname ?? ''),
          memberSince: typeof entry.member_since === 'string' ? entry.member_since : null,
        })
      ),
      networkUrl: this.extension.config.api_url,
    };
  }
}
