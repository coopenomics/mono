import { userStatus } from '~/types/user.types';
import { UserDomainEntity } from './user-domain.entity';

function userWith(status: userStatus): UserDomainEntity {
  return new UserDomainEntity(
    'u1', 'ant', status, '', false, false, 'individual', 'PUB', '', 'ivanov@example.com', 'user', false, 's1', 'h1',
  );
}

describe('UserDomainEntity.holdsEmail (занят ли адрес учётной записью)', () => {
  it('незавершённая регистрация адрес не держит: её можно начать заново на тот же адрес', () => {
    expect(userWith(userStatus['1_Created']).holdsEmail()).toBe(false);
  });

  it.each([
    userStatus['2_Joined'],
    userStatus['3_Payed'],
    userStatus['4_Registered'],
    userStatus['5_Active'],
    userStatus['10_Failed'],
    userStatus['90_Refunding'],
    userStatus['100_Refunded'],
    userStatus['200_Blocked'],
  ])('статус %s закрепляет адрес за учётной записью', (status) => {
    expect(userWith(status).holdsEmail()).toBe(true);
  });
});
