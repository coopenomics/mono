import type { MeetProcessedDomainInterface } from '../interfaces/meet-processed-domain.interface';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';

export class MeetProcessedDomainEntity implements MeetProcessedDomainInterface {
  public readonly coopname!: string;
  public readonly hash!: string;
  public readonly presider!: string;
  public readonly secretary!: string;
  public readonly presider_certificate?: UserCertificateDomainInterface | null;
  public readonly secretary_certificate?: UserCertificateDomainInterface | null;
  public readonly results!: any[];
  public readonly signed_ballots!: number;
  public readonly quorum_percent!: number;
  public readonly quorum_passed!: boolean;
  public readonly decision!: ISignedDocumentDomainInterface;

  constructor(
    data: Partial<MeetProcessedDomainInterface> & {
      decision: ISignedDocumentDomainInterface;
      presider: string;
      secretary: string;
    }
  ) {
    this.coopname = data.coopname || '';
    this.hash = data.hash || '';
    this.presider = data.presider;
    this.secretary = data.secretary;
    this.presider_certificate = data.presider_certificate || null;
    this.secretary_certificate = data.secretary_certificate || null;
    this.results = data.results || [];
    this.signed_ballots = data.signed_ballots || 0;
    this.quorum_percent = data.quorum_percent || 0;
    this.quorum_passed = data.quorum_passed || false;
    this.decision = data.decision;
  }
}
