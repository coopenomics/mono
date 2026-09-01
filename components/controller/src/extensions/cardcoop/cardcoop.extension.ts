/**
 * Расширение «Карта пайщика»: класс установки и её параметры.
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
import {
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  type DeserializedDescriptionOfExtension,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { z } from 'zod';

/** Подпись поля в форме настроек: председатель видит человеческий текст, а не имя параметра. */
const describeField = (description: DeserializedDescriptionOfExtension): string => JSON.stringify(description);

export const Schema = z.object({
  api_url: z
    .string()
    .url('Адрес должен быть ссылкой вида https://card.coop')
    .describe(
      describeField({
        label: 'Адрес сети «Карта пайщика»',
        note: 'Менять не требуется: значение по умолчанию рабочее. Поле оставлено для тестового контура.',
      })
    ),
  // Юридическая половина подключения кооперативов (story 7.6) — функция установки оператора,
  // а не каждого кооператива. Флаг, а не отдельное расширение: сеть и так примет объявление
  // только от кооператива, названного оператором в её конфигурации, — включённый по ошибке
  // флаг даёт отказ в журнале, а не чужие допуски.
  announce_as_operator: z
    .boolean()
    // default: поле появилось после первых установок, и конфиг без него обязан читаться.
    .default(false)
    .describe(
      describeField({
        label: 'Я — оператор сети (ВОСХОД)',
        note: 'Объявлять card.coop допуск кооперативов, активированных в цепи. Включается только на установке оператора сети.',
      })
    ),
});

export const defaultConfig = {
  api_url: 'https://card.coop',
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
    if (!extensionData) throw new Error(`Конфигурация расширения ${this.name} не найдена`);

    this.extension = extensionData;

    this.logger.info(`Инициализация ${this.name}`, { api_url: this.config.api_url });

  }

  /** Текущие параметры установки. Обращение до `initialize` — ошибка разработчика. */
  public get config(): IConfig {
    return this.extension.config;
  }
}
