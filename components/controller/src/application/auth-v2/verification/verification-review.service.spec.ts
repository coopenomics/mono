import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { VerificationReviewStatus } from '~/domain/auth-v2/verification/verification-review.types';
import { VerificationReviewService } from './verification-review.service';

/**
 * Сверку проводит участок, проверяет совет. Уровень выдаётся сразу, чтобы
 * пайщик забрал заказ; отклонение отзывает его обратно. Снимки живут только
 * до решения совета — после него кооператив хранит факт, а не документы.
 */
describe('VerificationReviewService', () => {
  const OPERATOR = { username: 'kuchair', role: 'user', braname: 'bra1' };
  const CHAIRMAN = { username: 'chair', role: 'chairman' };

  const photo = (content: string) => {
    const body = Buffer.from(content);
    return {
      content_base64: body.toString('base64'),
      mime_type: 'image/jpeg',
      size_bytes: body.byteLength,
      checksum_sha256: createHash('sha256').update(body).digest('hex'),
      original_filename: 'passport.jpg',
    };
  };

  const pendingReview = {
    id: 'rev-1',
    username: 'zoe',
    procedure: 'passport',
    braname: 'bra1',
    verificator: 'kuchair',
    status: VerificationReviewStatus.Pending,
    photos: [{ storage_key: 'k1', checksum_sha256: 'c1', mime_type: 'image/jpeg', size_bytes: 10, uploaded_at: '' }],
    created_at: '2026-08-21T10:00:00.000Z',
  };

  let bucket: { put: jest.Mock; getReadUrl: jest.Mock; delete: jest.Mock; head: jest.Mock };
  let reviews: {
    create: jest.Mock;
    findById: jest.Mock;
    findLatestByUsername: jest.Mock;
    list: jest.Mock;
    countByStatus: jest.Mock;
    decide: jest.Mock;
  };
  let chain: { verifyAccount: jest.Mock; unverifyAccount: jest.Mock };
  let authority: { assertMayReview: jest.Mock };
  let audit: { record: jest.Mock };
  let service: VerificationReviewService;

  beforeEach(() => {
    bucket = {
      put: jest.fn().mockResolvedValue({ key: 'k', etag: 'e', size: 1 }),
      getReadUrl: jest.fn().mockResolvedValue('https://coop/file'),
      delete: jest.fn().mockResolvedValue(undefined),
      head: jest.fn(),
    };
    reviews = {
      create: jest.fn().mockImplementation(async (draft) => ({ ...draft, created_at: '2026-08-21T10:00:00.000Z' })),
      findById: jest.fn().mockResolvedValue(pendingReview),
      findLatestByUsername: jest.fn().mockResolvedValue(pendingReview),
      list: jest.fn().mockResolvedValue([]),
      countByStatus: jest.fn().mockResolvedValue(0),
      decide: jest.fn().mockImplementation(async ({ id, status }) => ({ ...pendingReview, id, status, photos: [] })),
    };
    chain = { verifyAccount: jest.fn(), unverifyAccount: jest.fn().mockResolvedValue(undefined) };
    authority = { assertMayReview: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new VerificationReviewService(
      bucket as any,
      reviews as any,
      chain as any,
      authority as any,
      audit as any,
    );
  });

  it('на участке без единого снимка сверку не принимает', () => {
    expect(() => service.prepareVerification('bra1', [])).toThrow(BadRequestException);
  });

  it('совет сверяет без снимков — проверять его некому', () => {
    expect(service.prepareVerification('', [])).toEqual([]);
  });

  it('не принимает файл, у которого контрольная сумма не сходится с содержимым', () => {
    const broken = { ...photo('снимок'), checksum_sha256: 'a'.repeat(64) };
    expect(() => service.prepareVerification('bra1', [broken])).toThrow(BadRequestException);
  });

  it('не принимает файл, у которого не сходится заявленный размер', () => {
    const broken = { ...photo('снимок'), size_bytes: 1 };
    expect(() => service.prepareVerification('bra1', [broken])).toThrow(BadRequestException);
  });

  it('больше пяти снимков за одну сверку не принимает', () => {
    const many = Array.from({ length: 6 }, (_, i) => photo(`снимок ${i}`));
    expect(() => service.prepareVerification('bra1', many)).toThrow(BadRequestException);
  });

  it('сверка с участка ложится на проверку совета вместе со снимками', async () => {
    const prepared = service.prepareVerification('bra1', [photo('снимок')]);
    const review = await service.recordVerification({
      actor: OPERATOR,
      username: 'zoe',
      braname: 'bra1',
      photos: prepared,
    });

    expect(bucket.put).toHaveBeenCalledTimes(1);
    expect(review.status).toBe(VerificationReviewStatus.Pending);
    expect(review.photos).toHaveLength(1);
  });

  it('сверка совета сразу утверждённая: он и есть проверяющий', async () => {
    const review = await service.recordVerification({
      actor: CHAIRMAN,
      username: 'zoe',
      braname: '',
      photos: [],
    });

    expect(review.status).toBe(VerificationReviewStatus.Approved);
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('утверждение стирает снимки и не трогает цепь — уровень там уже есть', async () => {
    const decided = await service.approve(CHAIRMAN, 'rev-1');

    expect(chain.unverifyAccount).not.toHaveBeenCalled();
    expect(bucket.delete).toHaveBeenCalledWith('k1');
    expect(reviews.decide).toHaveBeenCalledWith(
      expect.objectContaining({ status: VerificationReviewStatus.Approved, clear_photos: true }),
    );
    expect(decided.status).toBe(VerificationReviewStatus.Approved);
  });

  it('отклонение отзывает верификацию с цепи и стирает снимки', async () => {
    const decided = await service.reject(CHAIRMAN, 'rev-1', 'на фото другой человек');

    expect(chain.unverifyAccount).toHaveBeenCalledWith(expect.objectContaining({ username: 'zoe' }));
    expect(bucket.delete).toHaveBeenCalledWith('k1');
    expect(decided.status).toBe(VerificationReviewStatus.Rejected);
  });

  it('решение по уже закрытой сверке не принимается повторно', async () => {
    reviews.findById.mockResolvedValue({ ...pendingReview, status: VerificationReviewStatus.Approved });
    await expect(service.approve(CHAIRMAN, 'rev-1')).rejects.toThrow(ConflictException);
  });

  it('несуществующая сверка — отказ, а не молчаливый успех', async () => {
    reviews.findById.mockResolvedValue(null);
    await expect(service.approve(CHAIRMAN, 'rev-1')).rejects.toThrow(NotFoundException);
  });

  it('снимки отдаёт только по сверке, ждущей решения', async () => {
    reviews.findById.mockResolvedValue({ ...pendingReview, status: VerificationReviewStatus.Approved, photos: [] });
    await expect(service.photoLinks(CHAIRMAN, 'rev-1')).rejects.toThrow(ConflictException);
  });

  it('выдачу снимков пишет в аудит: смотреть чужой паспорт молча нельзя', async () => {
    await service.photoLinks(CHAIRMAN, 'rev-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ParticipantVerificationPhotosViewed', subjectId: 'zoe' }),
    );
  });

  it('журнал и решения закрыты полномочием: сервис спрашивает разрешение', async () => {
    authority.assertMayReview.mockImplementation(() => {
      throw new ForbiddenException('нельзя');
    });
    await expect(service.list(OPERATOR, {})).rejects.toThrow(ForbiddenException);
    await expect(service.approve(OPERATOR, 'rev-1')).rejects.toThrow(ForbiddenException);
    await expect(service.reject(OPERATOR, 'rev-1', 'нет')).rejects.toThrow(ForbiddenException);
    await expect(service.photoLinks(OPERATOR, 'rev-1')).rejects.toThrow(ForbiddenException);
  });

  it('отзыв верификации отмечается в журнале — цепь истории не хранит', async () => {
    await service.recordRevocation('chair', 'zoe', 'ошибочная сверка');
    expect(reviews.decide).toHaveBeenCalledWith(
      expect.objectContaining({
        status: VerificationReviewStatus.Revoked,
        decided_by: 'chair',
        decision_reason: 'ошибочная сверка',
        clear_photos: true,
      }),
    );
  });

  it('повторный отзыв уже закрытой сверки ничего не переписывает', async () => {
    reviews.findLatestByUsername.mockResolvedValue({ ...pendingReview, status: VerificationReviewStatus.Rejected });
    await service.recordRevocation('chair', 'zoe');
    expect(reviews.decide).not.toHaveBeenCalled();
  });
});
