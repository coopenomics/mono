import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { JwtService } from '@nestjs/jwt';
import config from '~/config/config';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

describe('NotificationsModule', () => {
  let controller: NotificationsController;
  let service: NotificationsService;
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        NotificationsGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('должен создать контроллер', () => {
    expect(controller).toBeDefined();
  });

  it('должен создать сервис', () => {
    expect(service).toBeDefined();
  });

  it('должен создать gateway', () => {
    expect(gateway).toBeDefined();
  });

  describe('NotificationsService', () => {
    it('должен валидировать правильный subscriberId', () => {
      const user = { username: 'testuser' } as MonoAccountDomainInterface;
      const subscriberId = `${config.coopname}-testuser`;

      expect(() => service.validateAccess(user, subscriberId)).not.toThrow();
    });

    it('должен выбрасывать ошибку для неправильного subscriberId', () => {
      const user = { username: 'testuser' } as MonoAccountDomainInterface;
      const subscriberId = `${config.coopname}-anotheruser`;

      expect(() => service.validateAccess(user, subscriberId)).toThrow();
    });

    it('должен извлекать subscriberId из заголовков', () => {
      const headers = { 'x-novu-subscriber-id': 'test-subscriber' };
      const query = {};

      const result = service.extractSubscriberId(headers, query);
      expect(result).toBe('test-subscriber');
    });

    it('должен извлекать subscriberId из query параметров', () => {
      const headers = {};
      const query = { subscriberId: 'test-subscriber' };

      const result = service.extractSubscriberId(headers, query);
      expect(result).toBe('test-subscriber');
    });
  });
});
