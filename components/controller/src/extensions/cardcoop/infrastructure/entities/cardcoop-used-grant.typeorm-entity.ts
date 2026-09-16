import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * Гранты раскрытия, по которым анкета уже выдана (story 7.8, FR-F3).
 *
 * Грант — разрешение на один обмен, происходящий прямо сейчас, а не пропуск к анкете на все
 * пять минут его жизни. Без этого журнала предъявитель мог бы взять анкету по одному
 * согласию сколько угодно раз — в том числе тот, кому грант достался не от держателя.
 *
 * Одноразовость обеспечивает сам первичный ключ: повторная выдача по тому же согласию просто
 * не вставится, и разбирать гонку двух одновременных запросов не приходится.
 *
 * Записи не чистятся по сроку: строка на выданную анкету — это и есть журнал раскрытий на
 * стороне кооператива, и он должен пережить сам грант.
 */
@Entity('cardcoop_used_grants')
export class CardcoopUsedGrantTypeormEntity {
  /** Идентификатор согласия из гранта (`jti`); он же запись журнала card.coop. */
  @PrimaryColumn({ name: 'grant_jti', type: 'varchar', length: 64 })
  grantJti!: string;

  /** Карта держателя, чья анкета выдана. */
  @Column({ name: 'card_id', type: 'varchar', length: 64 })
  cardId!: string;

  /** Пайщик, чью анкету выдали, — по нему разбирают обращения самого человека. */
  @Column({ type: 'varchar', length: 64 })
  username!: string;

  /** Кооператив-получатель. */
  @Column({ name: 'to_coopname', type: 'varchar', length: 64 })
  toCoopname!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
