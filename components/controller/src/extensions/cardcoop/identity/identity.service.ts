/**
 * Сборка блока реквизитов для подтверждения членства (story 7.7).
 *
 * Отпечатки считает кооператив — тот, у кого анкета есть. card.coop анкеты не
 * получает: наружу уходят ФИО (наименование) и sha256 по каждому остальному
 * полю. Перца на этой стороне нет: чистый sha256 накладывается один раз здесь,
 * второй слой card.coop добавляет у себя при хранении (PRD §10 п.8) — поэтому
 * никаких секретов расширению принимать и ротировать не требуется.
 *
 * Значения НЕ преобразуются: ни `ё`→`е`, ни регистр, ни схлопывание пробелов,
 * ни разворачивание сокращений. Что в анкете — то и в отпечатке. Это цель, а не
 * недоделка: пайщик заполняет анкету как в паспорте, и расхождение написания
 * между кооперативами означает ошибку ввода, которую надо увидеть и исправить
 * повторной верификацией. Свели бы написания к канону — ошибка стала бы
 * невидимой.
 */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_PORT,
  type IAccountPort,
  InnerAccountType,
  INDIVIDUAL_PORT,
  type IIndividualPort,
  ORGANIZATION_PORT,
  type IOrganizationPort,
} from '@coopenomics/innercoop';
import type { CardcoopIdentityBlock, CardcoopIdentityDigests } from './identity.types';

/**
 * Поля, попадающие в отпечатки, — явным списком на каждый вид субъекта.
 *
 * Список, а не обход объекта: анкета в `cooptypes` со временем прирастает
 * полями, и обход означал бы, что состав блока молча меняется вместе с ней —
 * отпечатки перестали бы сходиться с уже отправленными, а причина была бы не
 * видна. Новое поле добавляется сюда осознанно и одновременно с card.coop.
 *
 * Перечень выровнен с `~/utils/registration-profile-fingerprint.ts`, где тот же
 * whitelist служит замком консистентности регистрации. Копия, а не импорт:
 * расширение живёт за границей контура и в код контроллера не заглядывает
 * (ADR-16). Расхождение перечней ловится приёмочными векторами story 4.7.
 *
 * ФИО и наименования в списках нет — они уходят открыто.
 */
const DIGEST_FIELDS: Record<InnerAccountType, readonly string[]> = {
  [InnerAccountType.individual]: [
    'birthdate',
    'full_address',
    'phone',
    'email',
    'passport.series',
    'passport.number',
    'passport.issued_by',
    'passport.issued_at',
    'passport.code',
  ],
  [InnerAccountType.entrepreneur]: [
    'birthdate',
    'phone',
    'email',
    'country',
    'city',
    'full_address',
    'details.inn',
    'details.ogrn',
  ],
  [InnerAccountType.organization]: [
    'type',
    'represented_by.last_name',
    'represented_by.first_name',
    'represented_by.middle_name',
    'represented_by.position',
    'represented_by.based_on',
    'country',
    'city',
    'full_address',
    'fact_address',
    'phone',
    'email',
    'details.inn',
    'details.ogrn',
    'details.kpp',
  ],
};

/** Значение вложенного поля по точечному пути. */
function readPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, part) => (acc == null ? undefined : (acc as Record<string, unknown>)[part]), source);
}

/**
 * Детерминированная кодировка значения перед хэшированием.
 *
 * Единственное преобразование во всей сборке, и оно не про написание: строка
 * берётся как есть, число переводится в десятичную запись без ведущих нулей
 * (серия и номер паспорта в анкете лежат числами). Нужна затем, чтобы MONO и
 * card.coop, считая по одним данным, сошлись байт в байт.
 *
 * `null` означает «поля в анкете нет» — такое поле в отпечатки не попадает
 * вовсе, и card.coop сверяет пересечение имеющихся.
 */
function encodeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (typeof value === 'boolean') return String(value);
  return null;
}

function digestOf(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

@Injectable()
export class CardcoopIdentityService {
  constructor(
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    @Inject(INDIVIDUAL_PORT) private readonly individuals: IIndividualPort,
    @Inject(ORGANIZATION_PORT) private readonly organizations: IOrganizationPort
  ) {}

  /**
   * Блок реквизитов пайщика для подтверждения членства.
   *
   * @param username учётное имя пайщика в кооперативе
   * @returns блок с открытым ФИО (наименованием) и отпечатками остальных полей
   * @throws если у пайщика нет анкеты — подтверждать нечего: кооператив
   *   свидетельствует о человеке, которого верифицировал, а не о пустой записи
   */
  async build(username: string): Promise<CardcoopIdentityBlock> {
    const { kind, source } = await this.read(username);

    return {
      kind,
      public: this.publicPart(kind, source),
      digests: this.digestPart(kind, source),
    };
  }

  /**
   * Анкета пайщика целиком — для выдачи кооперативу-получателю по гранту (story 7.8).
   *
   * Это единственное место, где анкета уходит из кооператива не отпечатками, а значениями, и
   * происходит это только по согласию держателя, удостоверенному card.coop. Состав не
   * урезается: получатель предзаполняет ею заявление, и недостающие поля человеку пришлось бы
   * вводить руками — то есть ровно тем способом, который и порождает расхождения реквизитов.
   *
   * Учётное имя пайщика в нашем кооперативе вырезается: у получателя оно будет своё, а знать
   * чужие внутренние имена ему незачем.
   *
   * @param username учётное имя пайщика в кооперативе
   * @returns вид субъекта и его анкета в форме `cooptypes`
   * @throws если анкеты нет — выдавать нечего
   */
  async profile(username: string): Promise<{ kind: InnerAccountType; data: Record<string, unknown> }> {
    const { kind, source } = await this.read(username);

    const data = { ...source };
    delete data.username;

    return { kind, data };
  }

  /**
   * Вид субъекта и его карточка.
   *
   * @param username учётное имя пайщика
   * @throws если у пайщика нет анкеты — свидетельствовать и раскрывать нечего: кооператив
   *   отвечает за человека, которого верифицировал, а не за пустую запись
   */
  private async read(username: string): Promise<{ kind: InnerAccountType; source: Record<string, unknown> }> {
    const account = await this.accounts.getAccount(username);
    const privateAccount = account.private_account;

    if (!privateAccount) {
      throw new Error(`Анкета пайщика ${username} не заполнена`);
    }

    const kind = privateAccount.type;
    const source = await this.readCard(kind, username, privateAccount);

    if (!source) {
      throw new Error(`Данные пайщика ${username} для вида субъекта «${kind}» не найдены`);
    }

    return { kind, source };
  }

  /**
   * Карточка пайщика.
   *
   * Физлицо и организацию читаем типизированными портами карточек — это
   * источник, который ведёт кооператив. Для ИП отдельного порта нет, поэтому
   * берём блок из учётной записи: форму ему задаёт `cooptypes`, а состав полей
   * мы всё равно перечисляем сами.
   */
  private async readCard(
    kind: InnerAccountType,
    username: string,
    privateAccount: { entrepreneur_data?: Record<string, unknown> }
  ): Promise<Record<string, unknown> | null> {
    if (kind === InnerAccountType.individual) {
      return (await this.individuals.findByUsername(username)) as unknown as Record<string, unknown>;
    }
    if (kind === InnerAccountType.organization) {
      return (await this.organizations.findByUsername(username)) as unknown as Record<string, unknown>;
    }
    return privateAccount.entrepreneur_data ?? null;
  }

  /** Открытая часть: то, что сеть покажет как держателя карты. */
  private publicPart(kind: InnerAccountType, source: Record<string, unknown>): CardcoopIdentityBlock['public'] {
    if (kind === InnerAccountType.organization) {
      return {
        short_name: String(source.short_name ?? ''),
        full_name: String(source.full_name ?? ''),
      };
    }
    return {
      last_name: String(source.last_name ?? ''),
      first_name: String(source.first_name ?? ''),
      middle_name: String(source.middle_name ?? ''),
    };
  }

  /** Отпечатки: имя поля → sha256 значения; пустые поля пропускаются. */
  private digestPart(kind: InnerAccountType, source: Record<string, unknown>): CardcoopIdentityDigests {
    const digests: CardcoopIdentityDigests = {};

    for (const field of DIGEST_FIELDS[kind]) {
      const encoded = encodeValue(readPath(source, field));
      if (encoded === null) continue;
      digests[field] = digestOf(encoded);
    }

    return digests;
  }
}
