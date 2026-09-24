/**
 * Расширение «Карта кооператора»: класс установки и её параметры.
 *
 * Живёт отдельно от файла модуля намеренно. Класс расширения нужен половине файлов
 * расширения — контроллерам, резолверам, слушателям цепи, — а файл модуля импортирует их
 * все. Пока класс лежал там же, каждый такой импорт замыкал круг: модуль тянул резолвер,
 * резолвер обратно тянул модуль, и в момент объявления резолвера класс расширения был ещё
 * не определён. Nest видел это как «зависимость недоступна в контексте модуля» и не
 * поднимал приложение вовсе — расширение не стартовало ни разу.
 *
 * Отдельный файл круг разрывает: он ничего из расширения не импортирует, поэтому его можно
 * загрузить первым откуда угодно.
 *
 * @packageDocumentation
 */
import { Inject, Injectable } from '@nestjs/common';
import { BaseExtensionModule, EXTENSION_REPOSITORY, type DeserializedDescriptionOfExtension, type ExtensionDomainEntity, type ExtensionDomainRepository, DomainError } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { z } from 'zod';
import { t } from './i18n';

/** Подпись поля в форме настроек: председатель видит человеческий текст, а не имя параметра. */
const describeField = (description: DeserializedDescriptionOfExtension): string => JSON.stringify(description);

export const Schema = z.object({
  api_url: z
    .string()
    .url(t('cardcoop.settings.apiUrlFormatHint'))
    .describe(
      describeField({
        label: t('cardcoop.settings.apiUrlLabel'),
        note: t('cardcoop.settings.apiUrlNote'),
      })
    ),
  // Вход в стол по карте сети (story 9.2). Кнопка появляется, когда сеть выдала установке
  // реквизиты клиента; этим флагом председатель может её убрать, оставив вход по паролю и ключу.
  entry_enabled: z
    .boolean()
    // default: поле появилось после первых установок, и конфиг без него обязан читаться.
    .default(true)
    .describe(
      describeField({
        label: t('cardcoop.settings.cardLoginLabel'),
        note: t('cardcoop.settings.cardLoginNote'),
      })
    ),
  // Юридическая половина подключения кооперативов (story 7.6) — функция установки оператора,
  // а не каждого кооператива. Оператор сети один и известен по имени (см. NETWORK_OPERATOR_COOPNAME),
  // поэтому поле скрыто (решение владельца 02.09.2026): у оператора оно включается само, а у
  // остальных включать его незачем — сеть примет объявление только от названного оператора.
  // В схеме остаётся ради конфигов, где оно уже стоит, и тестового контура.
  announce_as_operator: z
    .boolean()
    // default: поле появилось после первых установок, и конфиг без него обязан читаться.
    .default(false)
    .describe(
      describeField({
        label: t('cardcoop.settings.operatorLabel'),
        note: t('cardcoop.settings.operatorNote'),
        visible: false,
      })
    ),
});

export const defaultConfig = {
  // Узел сети — id.card.coop. Корень card.coop отдан лендингу: запросы туда
  // (объявление кооперативов, ключ вебхуков, подключение) получают 404, и с 08.09.2026
  // установки со старым умолчанием повторяли их впустую каждые пятнадцать минут.
  api_url: 'https://id.card.coop',
  entry_enabled: true,
  announce_as_operator: false,
};

export type IConfig = z.infer<typeof Schema>;

@Injectable()
export class CardcoopExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    super();
    this.logger.setContext(CardcoopExtension.name);
  }

  name = 'cardcoop';

  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  /** Читает установленную запись расширения и запоминает конфиг. */
  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw DomainError.internal('CARDCOOP_EXTENSION_CONFIG_NOT_FOUND', { name: this.name });

    this.extension = extensionData;

    this.logger.info(`Инициализация ${this.name}`, { api_url: this.config.api_url });

  }

  /** Текущие параметры установки. Обращение до `initialize` — ошибка разработчика. */
  public get config(): IConfig {
    return this.extension.config;
  }
}
