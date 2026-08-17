import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { MeetQuestionResultDomainInterface } from '~/domain/meet/interfaces/meet-decision-domain.interface';
import type { ISignedDocument } from '@coopenomics/innercoop';

@Entity('meet_processed')
export class MeetProcessedEntity {
  @PrimaryColumn()
  hash!: string;

  @Column({ type: 'jsonb', nullable: false })
  coopname!: string;

  @Column({ nullable: false })
  presider!: string;

  @Column({ nullable: false })
  secretary!: string;

  @Column({ type: 'jsonb', nullable: false })
  results!: MeetQuestionResultDomainInterface[];

  @Column({ nullable: false })
  signed_ballots!: number;

  @Column({ nullable: false })
  quorum_percent!: number;

  @Column({ nullable: false })
  quorum_passed!: boolean;

  @Column({ type: 'jsonb', nullable: false })
  decision!: ISignedDocument;
}
