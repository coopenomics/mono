/** Матрица доступа и разворот грантов «Образовательного моста». */
import { canAccess } from '~/extensions/edubridge/application/access/edubridge-access-matrix';
import { expandGrantsForRoles } from '~/extensions/edubridge/application/access/edubridge-grants';

describe('edubridge access matrix', () => {
  it('гость читает каталог и больше ничего', () => {
    expect(canAccess(['guest'], 'EduCatalog', 'read')).toBe(true);
    expect(canAccess(['guest'], 'EduCourse', 'manage')).toBe(false);
    expect(canAccess(['guest'], 'EduLearner', 'read:own')).toBe(false);
  });

  it('владелец: read:all покрывает read:own, контакты и площадки только у него', () => {
    expect(canAccess(['owner'], 'EduAssignment', 'read:own')).toBe(true);
    expect(canAccess(['owner'], 'EduContacts', 'read')).toBe(true);
    expect(canAccess(['admin'], 'EduContacts', 'read')).toBe(false);
    expect(canAccess(['admin'], 'EduConnector', 'manage')).toBe(false);
  });

  it('список действий — хотя бы одно', () => {
    expect(canAccess(['learner'], 'EduLearner', ['manage:own', 'manage'])).toBe(true);
    expect(canAccess(['teacher'], 'EduLearner', ['manage:own', 'manage'])).toBe(false);
  });

  it('разворот :all добавляет :own, чтобы фронт проходил требования пайщика', () => {
    const grants = expandGrantsForRoles(['admin']);
    expect(grants).toContain('EduAssignment:read:all');
    expect(grants).toContain('EduAssignment:read:own');
    expect(grants).not.toContain('EduContacts:read');
  });
});
