import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Состояние самоподключения к сети (story 7.6).
 *
 * Кооператив доносит параметры установки на каждом старте, на котором они изменились, — и
 * молчит, когда донесённое уже принято. Для этого хранится отпечаток последнего принятого
 * состава: без него каждый рестарт контроллера стучался бы в сеть, а с «однажды и хватит»
 * ротация секрета клиента никогда бы не доехала.
 *
 * Одна строка на установку: подключается кооператив, а не что-то во множественном числе.
 */
@Entity('cardcoop_connect_state')
export class CardcoopConnectStateTypeormEntity {
  /** Всегда `self`: таблица одной строки, и ключ здесь — способ это выразить. */
  @PrimaryColumn({ type: 'varchar', length: 8 })
  id!: string;

  /** Отпечаток последнего ПРИНЯТОГО сетью состава параметров. */
  @Column({ name: 'delivered_hash', type: 'varchar', length: 64, nullable: true })
  deliveredHash!: string | null;

  /** Причина последней неудачи; `null` — последняя попытка удалась. */
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
