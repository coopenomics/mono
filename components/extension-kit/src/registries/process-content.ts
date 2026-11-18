import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Содержание процесса для стола бухгалтера: о чём процесс словами предметной
 * области — имущество, стороны, суммы, состояние. Проводки, кошельки и
 * документы процесса стол показывает сам; содержание отвечает на вопрос
 * «что это за процесс», которого нет в учёте.
 *
 * Устройство как у стола совета: каждое приложение регистрирует поставщика
 * содержания на свои типы процессов (`processContentRegistry.register`), стол
 * рисует ответ одной общей карточкой. Тип процесса без поставщика содержания
 * не получает — стол показывает учёт без карточки.
 */

/** Строка «подпись — значение» в карточке содержания. */
@ObjectType('ProcessContentFact')
export class ProcessContentFactDTO {
  @Field(() => String, { description: 'Подпись: «Поставщик», «Участок»' })
  label!: string;

  @Field(() => String, { description: 'Значение словами: ФИО, название, дата' })
  value!: string;
}

/** Переход на страницу сущности процесса в приложении. */
@ObjectType('ProcessContentLink')
export class ProcessContentLinkDTO {
  @Field(() => String, { description: 'Надпись кнопки' })
  label!: string;

  @Field(() => String, { description: 'Путь страницы стола внутри кооператива, начиная с «/»' })
  path!: string;
}

/** Строка состава процесса: операция, чья она и сумма. */
@ObjectType('ProcessContentLine')
export class ProcessContentLineDTO {
  @Field(() => String, { description: 'Операция словами: «Отчисление в резервный фонд…»' })
  label!: string;

  @Field(() => String, { nullable: true, description: 'Пайщик, участок или кооператив операции' })
  subject?: string | null;

  @Field(() => String, { nullable: true, description: 'Сумма операции, актив «234.8400 RUB»' })
  amount?: string | null;
}

@ObjectType('ProcessContent')
export class ProcessContentDTO {
  @Field(() => String, {
    description: 'Главное: что это — название имущества, предмет расхода. Пусто — процесс называет заголовок места',
  })
  title!: string;

  @Field(() => String, { nullable: true, description: 'Строка под названием: количество, номер, период' })
  subtitle?: string | null;

  @Field(() => String, { nullable: true, description: 'Снимок предмета процесса (обложка имущества)' })
  image_url?: string | null;

  @Field(() => String, { nullable: true, description: 'Главная сумма процесса, актив «10000.0000 RUB»' })
  amount?: string | null;

  @Field(() => String, { nullable: true, description: 'Подпись главной суммы: «Стоимость имущества»' })
  amount_label?: string | null;

  @Field(() => String, { nullable: true, description: 'Состояние сущности процесса словами' })
  status?: string | null;

  @Field(() => [ProcessContentFactDTO], { description: 'Сведения по порядку чтения' })
  facts!: ProcessContentFactDTO[];

  @Field(() => [ProcessContentLinkDTO], { description: 'Переходы на страницы сущности' })
  links!: ProcessContentLinkDTO[];

  @Field(() => [ProcessContentLineDTO], { nullable: true, description: 'Состав процесса — операции по порядку' })
  lines?: ProcessContentLineDTO[] | null;
}

/** Поставщик содержания одного или нескольких типов процессов. */
export interface ProcessContentProvider {
  /**
   * Содержание процесса по хэшу. `null` — сущности нет (стёрта, не дошла до
   * узла): стол показывает учёт без карточки.
   */
  content(processHash: string, coopname: string, processType: string): Promise<ProcessContentDTO | null>;
}

/**
 * Реестр поставщиков содержания по типу процесса (`p.mkt.supply`, …).
 * Один на процесс узла: приложения регистрируются при старте модуля, запрос
 * `processContent` читает. Повторная регистрация типа заменяет поставщика —
 * так перезапуск модуля в тестах не копит записи.
 */
class ProcessContentRegistry {
  private readonly providers = new Map<string, ProcessContentProvider>();
  private fallback: ProcessContentProvider | null = null;

  /**
   * Общее содержание для процесса без описания приложения либо без записи
   * сущности (стёрта по завершении): ядро собирает его из сводки процесса —
   * чей процесс, сумма, назначение, даты.
   */
  registerFallback(provider: ProcessContentProvider): void {
    this.fallback = provider;
  }

  /** Содержание процесса: описание приложения, иначе общее из сводки. */
  async describe(processHash: string, coopname: string, processType: string): Promise<ProcessContentDTO | null> {
    const own = await this.providers.get(processType)?.content(processHash, coopname, processType);
    return own ?? (this.fallback ? this.fallback.content(processHash, coopname, processType) : null);
  }

  register(processTypes: string | string[], provider: ProcessContentProvider): void {
    for (const type of Array.isArray(processTypes) ? processTypes : [processTypes]) {
      this.providers.set(type, provider);
    }
  }

  get(processType: string): ProcessContentProvider | undefined {
    return this.providers.get(processType);
  }

  registeredTypes(): string[] {
    return [...this.providers.keys()];
  }
}

export const processContentRegistry = new ProcessContentRegistry();

// ---------------------------------------------------------------------------
// Помощники поставщиков содержания: одно оформление дат, сумм и строк сведений
// во всех приложениях.
// ---------------------------------------------------------------------------

/** Строка сведений, если значение есть: пустые строки карточка не показывает. */
export function contentFact(label: string, value: string | number | null | undefined): ProcessContentFactDTO[] {
  return value === null || value === undefined || value === '' ? [] : [{ label, value: String(value) }];
}

/** Дата словами: «17.11.2026», московское время, как в документах кооператива. */
export function contentDay(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined || date === '') return '';
  const value = typeof date === 'number' ? new Date(date * 1000) : new Date(date);
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
}

/**
 * Сумма словами для строки сведений: «100,00 RUB». Принимает актив цепи
 * («100.0000 RUB») и число строкой («100.0000») — тогда символ задаёт вызов.
 */
export function contentMoney(amount: string | number | null | undefined, symbol = ''): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const [value, assetSymbol] = String(amount).trim().split(/\s+/);
  const number = Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${number} ${assetSymbol || symbol}`.trim();
}

/**
 * Главная сумма карточки активом «10000.0000 RUB»: стол форматирует актив сам.
 * Актив цепи проходит как есть, к числу строкой дописываются точность и символ.
 */
export function contentAsset(amount: string | number | null | undefined, symbol: string, decimals = 4): string | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const text = String(amount).trim();
  return /\s/.test(text) ? text : `${Number(text).toFixed(decimals)} ${symbol}`;
}
