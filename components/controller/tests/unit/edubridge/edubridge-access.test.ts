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
    expect(canAccess(['edu-admin'], 'EduContacts', 'read')).toBe(false);
    expect(canAccess(['edu-admin'], 'EduConnector', 'manage')).toBe(false);
  });

  it('список действий — хотя бы одно', () => {
    expect(canAccess(['learner'], 'EduLearner', ['manage:own', 'manage'])).toBe(true);
    expect(canAccess(['teacher'], 'EduLearner', ['manage:own', 'manage'])).toBe(false);
  });

  it('перевод паевого взноса по программе в Цифровой Кошелёк — только у преподавателя', () => {
    expect(canAccess(['teacher'], 'EduTeacherWallet', 'manage:own')).toBe(true);
    expect(canAccess(['learner'], 'EduTeacherWallet', 'manage:own')).toBe(false);
    expect(canAccess(['edu-admin'], 'EduTeacherWallet', 'manage:own')).toBe(false);
    expect(canAccess(['guest'], 'EduTeacherWallet', 'read:own')).toBe(false);
  });

  it('столу права отдаются как записаны: :all не превращается в :own', () => {
    const grants = expandGrantsForRoles(['edu-admin']);
    expect(grants).toContain('EduAssignment:read:all');
    expect(grants).not.toContain('EduAssignment:read:own');
    expect(grants).not.toContain('EduContribution:read:own');
    expect(grants).not.toContain('EduContacts:read');
  });

  it('личные права преподавателя даёт только роль преподавателя', () => {
    expect(expandGrantsForRoles(['owner']).filter((g) => g.endsWith(':own'))).toEqual([]);
    expect(expandGrantsForRoles(['owner', 'teacher'])).toContain('EduAssignment:read:own');
  });

  // access.roles.happy.14
  it('член совета стол администратора читает и ничего не меняет', () => {
    for (const [resource, action] of [['EduCourse', 'read'], ['EduRegistry', 'read'], ['EduQueue', 'read'], ['EduAssignment', 'read:all'], ['EduContribution', 'read:all'], ['EduEconomy', 'read']]) {
      expect(canAccess(['council'], resource, action)).toBe(true);
    }
    for (const [resource, action] of [['EduCourse', 'manage'], ['EduQueue', 'manage'], ['EduAssignment', 'manage'], ['EduContribution', 'decide'], ['EduEconomy', 'manage'], ['EduConnector', 'manage']]) {
      expect(canAccess(['council'], resource, action)).toBe(false);
    }
  });

  // access.roles.happy.14
  it('администратор образования ведёт курсы, допуски и очередь; деньги и отклонение взноса — у председателя', () => {
    for (const [resource, action] of [['EduCourse', 'manage'], ['EduQueue', 'manage'], ['EduAssignment', 'manage'], ['EduCourse', 'read'], ['EduEconomy', 'read']]) {
      expect(canAccess(['edu-admin'], resource, action)).toBe(true);
    }
    for (const [resource, action] of [['EduEconomy', 'manage'], ['EduContribution', 'decide'], ['EduSettings', 'manage']]) {
      expect(canAccess(['edu-admin'], resource, action)).toBe(false);
      expect(canAccess(['owner'], resource, action)).toBe(true);
    }
  });
});
