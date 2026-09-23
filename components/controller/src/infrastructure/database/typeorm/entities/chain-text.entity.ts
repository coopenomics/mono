import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/** Текст, который в цепи лежит хешем: ключ — sha256 текста в шестнадцатеричной записи. */
@Entity('chain_texts')
export class ChainTextEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  digest!: string;

  @Column({ type: 'text' })
  text!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
