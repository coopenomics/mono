import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { AttributeEntity } from './attribute.entity';
import { DictionaryValueEntity } from './dictionary-value.entity';

@Entity('dictionaries')
export class DictionaryEntity {
  @PrimaryColumn({ name: 'dictionary_id' })
  dictionaryId!: number;

  @Column({ name: 'name', type: 'varchar', length: 500, nullable: true })
  name?: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => AttributeEntity, (attribute) => attribute.dictionary)
  attributes!: AttributeEntity[];

  @OneToMany(() => DictionaryValueEntity, (value) => value.dictionary, { cascade: true })
  values!: DictionaryValueEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
