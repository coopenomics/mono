import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EdubridgeLevelEntity } from './edubridge-level.entity';

/**
 * Раздел каталога — область знаний: «Математика», «Духовные практики».
 * Справочник ведёт администратор образования; курс ссылается на раздел, а не
 * хранит его строкой — раздел переименовывается и упорядочивается один раз
 * для всех курсов.
 */
@Entity({ name: 'edubridge_sections' })
@Index('IDX_edubridge_sections_title', ['coopname', 'title'], { unique: true })
export class EdubridgeSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 120 })
  public title!: string;

  /** Порядок в каталоге и форме курса: меньше — выше. */
  @Column({ type: 'int', default: 0 })
  public sort_order!: number;

  /** В архиве: не предлагается новым курсам и в каталоге, у старых курсов остаётся. */
  @Column({ type: 'boolean', default: false })
  public archived!: boolean;

  @OneToMany(() => EdubridgeLevelEntity, (l) => l.section)
  public levels?: EdubridgeLevelEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
