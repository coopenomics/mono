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

  /** `client_id` для «Входа с CardCOOP» — выдан сетью при подключении (story 9.2). */
  @Column({ name: 'rp_client_id', type: 'text', nullable: true })
  rpClientId!: string | null;

  /** `client_secret` того же клиента; сеть его не хранит и при подключении выдаёт заново. */
  @Column({ name: 'rp_client_secret', type: 'text', nullable: true })
  rpClientSecret!: string | null;

  /** Issuer провайдера на card.coop — по нему проверяется `iss` пришедших токенов. */
  @Column({ name: 'rp_issuer', type: 'text', nullable: true })
  rpIssuer!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
