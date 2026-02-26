jest.mock('../../../src/config', () => ({
  config: { coopname: 'testcoop' },
  default: { coopname: 'testcoop' },
}), { virtual: true });

jest.mock('../../../src/config/config', () => ({
  default: { coopname: 'testcoop' },
}), { virtual: true });

import { VoteCopyService } from '../../../src/extensions/soviet/domain/services/vote-copy.service';

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByCopier: jest.fn(),
  findBySource: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('VoteCopyService', () => {
  let service: VoteCopyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VoteCopyService(mockRepo as any);
  });

  describe('createSetting', () => {
    it('создаёт настройку копирования', async () => {
      mockRepo.findByCopier.mockResolvedValue([]);
      mockRepo.create.mockResolvedValue({
        id: '1',
        copier_username: 'member1',
        source_username: 'chairman',
        decision_types: [],
        is_active: true,
      });

      const result = await service.createSetting('member1', 'chairman');
      expect(result.copier_username).toBe('member1');
      expect(result.source_username).toBe('chairman');
      expect(result.is_active).toBe(true);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('запрещает копировать собственный голос', async () => {
      await expect(service.createSetting('member1', 'member1')).rejects.toThrow('Нельзя копировать собственный голос');
    });

    it('запрещает дублирование активной настройки', async () => {
      mockRepo.findByCopier.mockResolvedValue([
        { source_username: 'chairman', is_active: true },
      ]);

      await expect(service.createSetting('member1', 'chairman')).rejects.toThrow('уже настроено');
    });

    it('разрешает повторное создание если предыдущая неактивна', async () => {
      mockRepo.findByCopier.mockResolvedValue([
        { source_username: 'chairman', is_active: false },
      ]);
      mockRepo.create.mockResolvedValue({ id: '2', is_active: true });

      const result = await service.createSetting('member1', 'chairman');
      expect(result.is_active).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('деактивирует настройку владельца', async () => {
      mockRepo.findById.mockResolvedValue({ id: '1', copier_username: 'member1' });
      mockRepo.update.mockResolvedValue({ id: '1', is_active: false });

      const result = await service.deactivate('1', 'member1');
      expect(result.is_active).toBe(false);
    });

    it('запрещает деактивацию чужой настройки', async () => {
      mockRepo.findById.mockResolvedValue({ id: '1', copier_username: 'member2' });
      await expect(service.deactivate('1', 'member1')).rejects.toThrow('Нет доступа');
    });

    it('ошибка если настройка не найдена', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.deactivate('999', 'member1')).rejects.toThrow('не найдена');
    });
  });

  describe('deleteSetting', () => {
    it('удаляет настройку владельца', async () => {
      mockRepo.findById.mockResolvedValue({ id: '1', copier_username: 'member1' });
      mockRepo.delete.mockResolvedValue(undefined);

      await service.deleteSetting('1', 'member1');
      expect(mockRepo.delete).toHaveBeenCalledWith('1');
    });

    it('запрещает удаление чужой настройки', async () => {
      mockRepo.findById.mockResolvedValue({ id: '1', copier_username: 'other' });
      await expect(service.deleteSetting('1', 'member1')).rejects.toThrow('Нет доступа');
    });
  });

  describe('findActiveCopiers', () => {
    it('возвращает только активных копирующих', async () => {
      mockRepo.findBySource.mockResolvedValue([
        { copier_username: 'a', is_active: true },
        { copier_username: 'b', is_active: false },
        { copier_username: 'c', is_active: true },
      ]);

      const result = await service.findActiveCopiers('chairman');
      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.copier_username)).toEqual(['a', 'c']);
    });

    it('возвращает пустой массив если никто не копирует', async () => {
      mockRepo.findBySource.mockResolvedValue([]);
      const result = await service.findActiveCopiers('chairman');
      expect(result).toHaveLength(0);
    });
  });

  describe('getMySettings / getWhoCopiesToMe', () => {
    it('getMySettings вызывает findByCopier', async () => {
      mockRepo.findByCopier.mockResolvedValue([]);
      await service.getMySettings('member1');
      expect(mockRepo.findByCopier).toHaveBeenCalled();
    });

    it('getWhoCopiesToMe вызывает findBySource', async () => {
      mockRepo.findBySource.mockResolvedValue([]);
      await service.getWhoCopiesToMe('chairman');
      expect(mockRepo.findBySource).toHaveBeenCalled();
    });
  });
});
