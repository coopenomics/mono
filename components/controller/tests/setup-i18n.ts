/**
 * jest setupFiles — словари для отказов и надписей в спеках.
 *
 * Зачем. В приложении словари ядра регистрирует AppModule, а словарь
 * расширения — модуль расширения. Спек поднимает сервис без модулей Nest,
 * и `DomainError` без словаря получил бы вместо текста ключ — тесты,
 * сверяющие текст отказа, упали бы не по делу. Здесь регистрируются все
 * словари сразу; имя источника совпадает с тем, под которым словарь
 * регистрирует само расширение (`extension:<каталог>`), поэтому повторная
 * регистрация из модуля ничего не ломает.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

require('../src/i18n');
const { registerMessages } = require('@coopenomics/i18n/server');

const extensionsRoot = path.join(__dirname, '../src/extensions');
for (const name of fs.readdirSync(extensionsRoot)) {
  const file = path.join(extensionsRoot, name, 'i18n', 'ru.json');
  if (fs.existsSync(file)) {
    registerMessages('ru', JSON.parse(fs.readFileSync(file, 'utf8')), `extension:${name}`);
  }
}
