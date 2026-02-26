import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { DictionaryEntity } from './dictionary.entity';

@Entity('dictionary_values')
export class DictionaryValueEntity {
  @PrimaryColumn({ name: 'dictionary_value_id' })
  dictionaryValueId!: number;

  @Column({ name: 'value', type: 'varchar', length: 1000 })
  value!: string;

  @Column({ name: 'info', type: 'text', nullable: true })
  info?: string;

  @Column({ name: 'picture', type: 'varchar', length: 1000, nullable: true })
  picture?: string;

  @Column({ name: 'dictionary_id' })
  dictionaryId!: number;

  @ManyToOne(() => DictionaryEntity, (dictionary) => dictionary.values)
  @JoinColumn({ name: 'dictionary_id' })
  dictionary!: DictionaryEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
