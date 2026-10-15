/**
 * Сравнение публичных ключей робота. Один и тот же ключ ходит в двух записях —
 * старой `EOS…` и новой `PUB_K1_…`. Узел отдаёт одну форму, в хранилище может
 * лежать другая (так пишет предустановка стенда), и сравнение строк объявляло
 * бы исправный ключ несовпадающим: члену совета показывалось «ключ не совпадает
 * с цепью», хотя ключ тот самый.
 */
import { PrivateKey, KeyType, PublicKey } from '@wharfkit/antelope';
import { RobotKeyService } from '~/extensions/soviet-robot/application/services/robot-key.service';

describe('RobotKeyService.normalize', () => {
  const key = PrivateKey.generate(KeyType.K1).toPublic();
  const modern = key.toString();
  const legacy = key.toLegacyString();

  it('обе записи одного ключа приводятся к одному виду', () => {
    expect(legacy.startsWith('EOS')).toBe(true);
    expect(modern.startsWith('PUB_K1_')).toBe(true);
    expect(RobotKeyService.normalize(legacy)).toBe(RobotKeyService.normalize(modern));
  });

  it('разные ключи остаются разными', () => {
    const other = PrivateKey.generate(KeyType.K1).toPublic().toLegacyString();
    expect(RobotKeyService.normalize(other)).not.toBe(RobotKeyService.normalize(legacy));
  });

  it('неразобранный ключ возвращается как есть и не роняет чтение состояния', () => {
    expect(RobotKeyService.normalize('не ключ')).toBe('не ключ');
  });

  it('приведение обратимо: из нормализованного вида восстанавливается тот же ключ', () => {
    expect(PublicKey.from(RobotKeyService.normalize(legacy)).toLegacyString()).toBe(legacy);
  });
});
