import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('push_subscriptions')
@Index(['userId'], { unique: false })
@Index(['endpoint'], { unique: true })
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 255 })
  userId: string;

  @Column('text')
  endpoint: string;

  @Column('varchar', { length: 255 })
  p256dhKey: string;

  @Column('varchar', { length: 255 })
  authKey: string;

  @Column('varchar', { length: 100, nullable: true })
  userAgent: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Удобный метод для получения подписки в формате web-push
  toWebPushSubscription() {
    return {
      endpoint: this.endpoint,
      keys: {
        p256dh: this.p256dhKey,
        auth: this.authKey,
      },
    };
  }
} 