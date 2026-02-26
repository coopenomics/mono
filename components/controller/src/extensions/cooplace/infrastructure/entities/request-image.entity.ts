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

@Entity('marketplace_request_images')
@Index(['requestId', 'sortOrder'])
export class RequestImageEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'request_id' })
  @Index('idx_request_image_request_id')
  requestId!: number;

  @Column({ name: 'image_url', type: 'text' })
  imageUrl!: string;

  @Column({
    name: 'image_type',
    type: 'enum',
    enum: ['regular', 'primary', 'color_sample', 'image_360'],
    default: 'regular',
  })
  imageType!: 'regular' | 'primary' | 'color_sample' | 'image_360';

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description?: string;

  // Связи
  @ManyToOne(() => RequestEntity, (request) => request.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request!: RequestEntity;

  // Временные метки
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
