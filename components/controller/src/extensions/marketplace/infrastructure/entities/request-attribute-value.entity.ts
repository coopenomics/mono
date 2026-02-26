import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { RequestEntity } from './request.entity';
import { AttributeEntity } from './attribute.entity';

@Entity('marketplace_request_attribute_values')
@Index(['requestId', 'attributeId'])
export class RequestAttributeValueEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'request_id' })
  @Index('idx_request_attr_request_id')
  requestId!: number;

  @Column({ name: 'attribute_id' })
  @Index('idx_request_attr_attribute_id')
  attributeId!: number;

  @Column({ name: 'complex_id', type: 'integer', default: 0 })
  complexId!: number;

  @Column({ name: 'value', type: 'text' })
  value!: string;

  @Column({ name: 'dictionary_value_id', type: 'integer', nullable: true })
  dictionaryValueId?: number;

  // Связи
  @ManyToOne(() => RequestEntity, (request) => request.attributes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request!: RequestEntity;

  @ManyToOne(() => AttributeEntity, { eager: true })
  @JoinColumn({ name: 'attribute_id' })
  attribute!: AttributeEntity;

  // Временные метки
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
