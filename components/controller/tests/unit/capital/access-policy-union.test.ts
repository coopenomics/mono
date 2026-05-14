import {
  IssueAccessPolicyService,
  IssueAction,
  ProjectAction,
  ProjectUserRole,
  UserRole,
} from '../../../src/extensions/capital/domain/services/access-policy.service';
import { IssueStatus } from '../../../src/extensions/capital/domain/enums/issue-status.enum';

describe('IssueAccessPolicyService — UNION-семантика по нескольким ролям', () => {
  const policy = new IssueAccessPolicyService();

  describe('hasProjectPermission', () => {
    it('GUEST: запрещены все project-actions', () => {
      const roles = new Set([ProjectUserRole.GUEST]);
      expect(policy.hasProjectPermission(roles, ProjectAction.EDIT_REQUIREMENT)).toBe(false);
      expect(policy.hasProjectPermission(roles, ProjectAction.EDIT_PROJECT)).toBe(false);
    });

    it('AUTHOR (соавтор): EDIT_REQUIREMENT=true, CHANGE_PROJECT_STATUS=false', () => {
      const roles = new Set([ProjectUserRole.AUTHOR]);
      expect(policy.hasProjectPermission(roles, ProjectAction.EDIT_REQUIREMENT)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.CHANGE_PROJECT_STATUS)).toBe(false);
    });

    it('BOARD_MEMBER (чистый): CHANGE_PROJECT_STATUS=true, EDIT_REQUIREMENT=false (как раньше)', () => {
      const roles = new Set([ProjectUserRole.BOARD_MEMBER]);
      expect(policy.hasProjectPermission(roles, ProjectAction.CHANGE_PROJECT_STATUS)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.EDIT_REQUIREMENT)).toBe(false);
    });

    // Главный кейс — починка регрессии «соавтор-член-совета не может править артефакты»
    it('BOARD_MEMBER + AUTHOR: получает права обеих ролей', () => {
      const roles = new Set([ProjectUserRole.BOARD_MEMBER, ProjectUserRole.AUTHOR]);
      expect(policy.hasProjectPermission(roles, ProjectAction.EDIT_REQUIREMENT)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.CREATE_REQUIREMENT)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.DELETE_REQUIREMENT)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.CHANGE_PROJECT_STATUS)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.SET_MASTER)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.MANAGE_ISSUES)).toBe(true);
    });

    it('CHAIRMAN + MASTER: union (председатель остаётся всемогущим, мастер ничего не отнимает)', () => {
      const roles = new Set([ProjectUserRole.CHAIRMAN, ProjectUserRole.MASTER]);
      expect(policy.hasProjectPermission(roles, ProjectAction.DELETE_PROJECT)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.SET_MASTER)).toBe(true);
      expect(policy.hasProjectPermission(roles, ProjectAction.EDIT_REQUIREMENT)).toBe(true);
    });

    it('пустое множество: всё запрещено', () => {
      expect(policy.hasProjectPermission(new Set(), ProjectAction.EDIT_REQUIREMENT)).toBe(false);
    });
  });

  describe('hasPermission (issue-actions)', () => {
    it('CONTRIBUTOR (чистый): EDIT_REQUIREMENT=false', () => {
      expect(policy.hasPermission(new Set([UserRole.CONTRIBUTOR]), IssueAction.EDIT_REQUIREMENT)).toBe(false);
    });

    it('BOARD_MEMBER + AUTHOR на задаче: EDIT_REQUIREMENT=true (через AUTHOR)', () => {
      const roles = new Set([UserRole.BOARD_MEMBER, UserRole.AUTHOR]);
      expect(policy.hasPermission(roles, IssueAction.EDIT_REQUIREMENT)).toBe(true);
      expect(policy.hasPermission(roles, IssueAction.CHANGE_STATUS)).toBe(true);
    });

    it('SUBMASTER + AUTHOR: SET_ON_REVIEW (через SUBMASTER) + EDIT_REQUIREMENT (через AUTHOR)', () => {
      const roles = new Set([UserRole.SUBMASTER, UserRole.AUTHOR]);
      expect(policy.hasPermission(roles, IssueAction.SET_ON_REVIEW)).toBe(true);
      expect(policy.hasPermission(roles, IssueAction.EDIT_REQUIREMENT)).toBe(true);
    });
  });

  describe('canTransitionStatus / getAllowedStatusTransitions', () => {
    it('BACKLOG → DONE доступен MASTER, недоступен AUTHOR; union → доступен', () => {
      expect(
        policy.canTransitionStatus(new Set([UserRole.AUTHOR]), IssueStatus.BACKLOG, IssueStatus.DONE)
      ).toBe(false);
      expect(
        policy.canTransitionStatus(new Set([UserRole.MASTER]), IssueStatus.BACKLOG, IssueStatus.DONE)
      ).toBe(true);
      expect(
        policy.canTransitionStatus(
          new Set([UserRole.AUTHOR, UserRole.MASTER]),
          IssueStatus.BACKLOG,
          IssueStatus.DONE
        )
      ).toBe(true);
    });

    it('getAllowedStatusTransitions: union собирает разрешения по всем ролям', () => {
      const authorOnly = policy.getAllowedStatusTransitions(new Set([UserRole.AUTHOR]), IssueStatus.BACKLOG);
      const masterOnly = policy.getAllowedStatusTransitions(new Set([UserRole.MASTER]), IssueStatus.BACKLOG);
      const union = policy.getAllowedStatusTransitions(
        new Set([UserRole.AUTHOR, UserRole.MASTER]),
        IssueStatus.BACKLOG
      );
      const expectedUnion = Array.from(new Set([...authorOnly, ...masterOnly])).sort();
      expect([...union].sort()).toEqual(expectedUnion);
      // Sanity: master может больше автора → union строго ⊇ author-only
      for (const s of authorOnly) expect(union).toContain(s);
    });

    it('переход в тот же статус — true, даже для GUEST', () => {
      expect(
        policy.canTransitionStatus(new Set([UserRole.GUEST]), IssueStatus.BACKLOG, IssueStatus.BACKLOG)
      ).toBe(true);
    });
  });
});
