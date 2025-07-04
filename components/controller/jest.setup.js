// jest.setup.js
process.env.NODE_ENV = 'test';

// Мокаем config если нужно
jest.mock('~/config/config', () => ({
  default: {
    jwt: {
      secret: 'test-secret',
      accessExpirationMinutes: '60m',
    },
    coopname: 'test-coop',
    novu: {
      backend_url: 'http://localhost:3000',
      socket_url: 'ws://localhost:3000',
      api_key: 'test-api-key',
      app_id: 'test-app-id',
    },
  },
}));
