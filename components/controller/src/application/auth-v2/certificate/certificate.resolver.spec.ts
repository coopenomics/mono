import type { CertificateService } from './certificate.service';
import { CertificateResolver } from './certificate.resolver';

describe('CertificateResolver', () => {
  it('getMyCertificate выдаёт удостоверение текущего пайщика', async () => {
    const certificateService = {
      issueForUsername: jest.fn(async () => 'jws.payload.sig'),
    };
    const resolver = new CertificateResolver(certificateService as unknown as CertificateService);
    const out = await resolver.getMyCertificate({ id: 'u1', username: 'payer1', role: 'user' });
    expect(certificateService.issueForUsername).toHaveBeenCalledWith('payer1');
    expect(out).toEqual({ participant_certificate: 'jws.payload.sig' });
  });
});
