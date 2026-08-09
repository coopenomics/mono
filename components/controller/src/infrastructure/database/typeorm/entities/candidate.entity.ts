import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { ISignedDocument } from '@coopenomics/innercoop';

@Entity('candidates')
export class CandidateEntity {
  @PrimaryColumn()
  username!: string;

  @Column()
  coopname!: string;

  @Column({ nullable: true })
  braname!: string;

  @Column()
  status!: string;

  @Column({ nullable: true })
  registered_at?: Date;

  @Column()
  type!: string; // individual, organization, entrepreneur

  @CreateDateColumn()
  created_at!: Date;

  @Column('json', { nullable: true })
  statement?: ISignedDocument;

  @Column('json', { nullable: true })
  wallet_agreement?: ISignedDocument;

  @Column('json', { nullable: true })
  signature_agreement?: ISignedDocument;

  @Column('json', { nullable: true })
  privacy_agreement?: ISignedDocument;

  @Column('json', { nullable: true })
  user_agreement?: ISignedDocument;

  @Column('json', { nullable: true })
  blagorost_offer?: ISignedDocument;

  @Column('json', { nullable: true })
  generator_offer?: ISignedDocument;

  /** Generic map agreement_id → signed document (marketplace и следующие расширения). */
  @Column('jsonb', { nullable: false, default: {} })
  program_agreements!: Record<string, ISignedDocument>;

  @Column({ nullable: true })
  program_key?: string;

  @Column({ nullable: false })
  registration_hash!: string;

  @Column({ nullable: true })
  referer?: string;

  @Column()
  public_key!: string;

  @Column({ nullable: true })
  meta?: string;
}
