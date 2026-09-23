import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EdubridgeSectionEntity } from './edubridge-section.entity';

/**
 * Уровень внутри раздела: «7 класс», «Ступень 1». Порядок уровней в разделе —
 * их последовательность: на нём строятся правила, какой уровень открывается
 * после какого.
 */
@Entity({ name: 'edubridge_levels' })
@Index('IDX_edubridge_levels_title', ['section_id', 'title'], { unique: true })
export class EdubridgeLevelEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public section_id!: string;

  @ManyToOne(() => EdubridgeSectionEntity, (s) => s.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  public section?: EdubridgeSectionEntity;

  @Column({ type: 'varchar', length: 60 })
  public title!: string;

  /** Место уровня в последовательности раздела: меньше — раньше. */
  @Column({ type: 'int', default: 0 })
  public sort_order!: number;

  /** В архиве: не предлагается новым курсам и в каталоге, у старых курсов остаётся. */
  @Column({ type: 'boolean', default: false })
  public archived!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
