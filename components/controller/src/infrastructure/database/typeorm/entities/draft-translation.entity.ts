import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

/**
 * Версия перевода шаблона на определённом блоке.
 *
 * Устроена так же, как история шаблонов: перевод — часть текста документа, и
 * при повторной сборке подписанного документа нужен тот перевод, что
 * действовал на момент подписи, а не текущий.
 */
@Entity('draft_translations')
@Unique(['draft_id', 'lang', 'block_num'])
@Index(['draft_id', 'lang', 'block_num'])
export class DraftTranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Шаблон, к которому относится перевод. */
  @Column({ type: 'bigint' })
  draft_id!: string;

  /** Язык перевода. */
  @Column({ type: 'varchar', length: 16 })
  lang!: string;

  /** Блок, на котором перевод принял это состояние. */
  @Column({ type: 'bigint' })
  block_num!: number;

  /** Строка таблицы `draft::translations` целиком — см. пояснение у шаблонов. */
  @Column({ type: 'jsonb' })
  value!: any;

  /** false — строка удалена из он-чейн таблицы; версия остаётся доступной. */
  @Column({ type: 'boolean', default: true })
  present!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
