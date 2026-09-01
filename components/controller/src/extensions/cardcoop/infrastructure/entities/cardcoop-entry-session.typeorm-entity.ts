import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** Куда пришёл вход по карте: человек уже пайщик либо кандидат на быструю регистрацию. */
export enum CardcoopEntryOutcome {
  /** Действующее подтверждение членства есть — карта опознала пайщика. */
  Member = 'member',
  /** Членства нет — путь ведёт в быструю регистрацию (story 9.3). */
  Candidate = 'candidate',
}

/** Состояние быстрой регистрации по карте. */
export enum CardcoopEntryStatus {
  /** Вход состоялся, решения о раскрытии ещё нет. */
  Started = 'started',
  /** Запрос раскрытия отправлен — ждём решения держателя на card.coop. */
  AwaitingConsent = 'awaiting_consent',
  /** Анкета получена от кооператива-источника и ждёт единственного прочтения. */
  ProfileReady = 'profile_ready',
  /** Держатель отказал: анкеты не будет, регистрация продолжается руками. */
  Denied = 'denied',
  /**
   * Держатель не ответил в срок: молчание согласием не считается.
   *
   * Состояние заведено потому, что у ожидания обязан быть конец (3B5-54): прежде сессия
   * висела в ожидании вечно, а страница опрашивала сервер каждые три секунды до закрытия
   * вкладки. Человеку это выглядело как «сайт завис», хотя решение просто не было принято.
   */
  Expired = 'expired',
  /**
   * Согласие получено, но анкету привезти не удалось.
   *
   * Причины разные — грант умер, пока уведомление ехало; источник ответил ошибкой; подпись
   * не сошлась, — но для человека исход один: переносить нечего. Разбор причины остаётся в
   * журнале кооператива, а вступающему предлагается повторить или заполнить руками.
   */
  Failed = 'failed',
}

/**
 * Сессия входа по карте (story 9.2/9.3, FR-F1/F2/F4).
 *
 * Живёт между возвратом из card.coop и завершением регистрации. Идентификатор — случайный
 * UUID и единственный ключ доступа: сессию заводит сам вход, и никто, кроме вернувшегося
 * браузера, идентификатора не знает.
 *
 * Анкета, полученная от кооператива-источника, лежит здесь ВРЕМЕННО и читается ровно один
 * раз (`profileTakenAt`): повторное открытие ссылки из истории браузера получает пустоту,
 * а не персональные данные. Просроченные сессии вычищаются вместе с анкетами.
 */
@Entity('cardcoop_entry_sessions')
export class CardcoopEntrySessionTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Карта держателя из токена card.coop. */
  @Column({ name: 'card_id', type: 'varchar', length: 64 })
  cardId!: string;

  /** Номер карты для показа человеку. */
  @Column({ name: 'card_number', type: 'varchar', length: 32, nullable: true })
  cardNumber!: string | null;

  /** Пайщик или кандидат. */
  @Column({ type: 'varchar', length: 16 })
  outcome!: CardcoopEntryOutcome;

  /** Пайщик, которого опознала карта; `null` у кандидата. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  username!: string | null;

  /** Членства из claims card.coop — кандидат выбирает из них кооператив-источник. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  memberships!: Array<Record<string, unknown>>;

  /** Согласие, которого ждём; по нему находится сессия при доставке гранта. */
  @Column({ name: 'disclosure_id', type: 'varchar', length: 64, nullable: true })
  disclosureId!: string | null;

  /** Состояние быстрой регистрации. */
  @Column({ type: 'varchar', length: 24, default: CardcoopEntryStatus.Started })
  status!: CardcoopEntryStatus;

  /** Вид субъекта полученной анкеты. */
  @Column({ name: 'profile_type', type: 'varchar', length: 24, nullable: true })
  profileType!: string | null;

  /** Полученная анкета; стирается при прочтении. */
  @Column({ type: 'jsonb', nullable: true })
  profile!: Record<string, unknown> | null;

  /** Когда анкету забрали в форму; повторного прочтения не существует. */
  @Column({ name: 'profile_taken_at', type: 'timestamp', nullable: true })
  profileTakenAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
