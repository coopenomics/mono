// Сценарий: «Реестр контрагентов» на столе совета (задача 99D-35) —
// организации и ИП, которым кооператив платит по реквизитам. Председатель
// добавляет контрагента: форма по стране кооператива, ошибка контрольной
// суммы у поля при вводе, затем верные реквизиты, строка реестра и панель
// справа с реквизитами и действиями.
//
// Счёт контрагента — случайный, с верным ключом по БИК: повторный запуск
// сценария не упирается в «такой контрагент уже есть».

import crypto from 'node:crypto';
import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'expenses.counterparties',
  title: 'Реестр контрагентов',
  docPath: 'new/expenses/counterparties.md',
  assetsDir: 'assets/new/expenses/counterparties',
  role: 'chairman',
  fixtures: [],
  cases: ['exp.cp.ui.01', 'exp.cp.ui.02'],
};

const BIK = '044525225';

/** Расчётный счёт с верным ключом по БИК: ключ — девятая цифра, веса 7-1-3. */
function account() {
  const tail = String(crypto.randomInt(0, 1e11)).padStart(11, '0');
  const digits = (BIK.slice(-3) + `407028100${tail}`).split('').map(Number);
  const weights = [7, 1, 3];
  const sum = digits.reduce((s, d, i) => s + d * weights[i % 3], 0);
  const key = (((10 - (sum % 10)) % 10) * 7) % 10;
  return `40702810${key}${tail}`;
}

/**
 * Ввод в поле формы. Где подключён поиск по ИНН, наименование, КПП и ОГРН
 * подставляет реестр и закрывает для правки — такое поле сценарий пропускает.
 */
async function fill(dialog, label, value) {
  const input = dialog.getByLabel(label, { exact: true }).first();
  if (!(await input.isEditable())) return;
  await input.click();
  await input.fill(value);
}

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/soviet/counterparties`, null);
  await page.waitForTimeout(1500);

  await shot(
    page,
    '01-registry',
    'Реестр контрагентов на столе совета: поиск по наименованию или ИНН, показ архива, таблица — наименование и ИНН, вид, кто добавил, состояние. Кнопка «Добавить контрагента» — в шапке.',
  );

  await page.locator('button:has-text("Добавить контрагента")').first().click();
  const dialog = page.locator('.q-dialog').last();
  await expect(dialog.locator('text=Новый контрагент').first()).toBeVisible({ timeout: 20000 });
  await fill(dialog, 'ИНН', '1231231231');
  await fill(dialog, 'Наименование', 'ПАО Сбербанк');
  await page.waitForTimeout(1200);
  await shot(
    page,
    '02-checksum',
    'Форма контрагента: поля и правила — по стране кооператива. ИНН с опечаткой проверка отмечает сразу у поля: «Ошибка в номере». Расчётный счёт сверяется с БИК, когда БИК введён целиком. КПП принимает 9 знаков, буквы — только в пятом и шестом.',
    {
      expect: async () => {
        await expect(dialog.locator('text=Ошибка в номере').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  await fill(dialog, 'ИНН', '7707083893');
  await fill(dialog, 'КПП', '773601001');
  await fill(dialog, 'ОГРН', '1027700132195');
  await fill(dialog, 'Расчётный счёт', account());
  await fill(dialog, 'Банк', 'ПАО Сбербанк');
  await fill(dialog, 'БИК', BIK);
  await fill(dialog, 'Корр. счёт', '30101810400000000225');
  await fill(dialog, 'Назначение платежа по умолчанию', 'Оплата по договору. Без НДС');
  await page.waitForTimeout(1200);
  await shot(page, '03-form', 'Реквизиты заполнены верно: замечаний у полей нет. Назначение платежа по умолчанию подставляется в плановый расход и служебную записку.');

  await dialog.locator('button:has-text("Сохранить")').first().click();
  await expect(page.locator('td:has-text("ПАО Сбербанк")').first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, '04-row', 'Контрагент в реестре: контрагент кооператива, действует.');

  await page.locator('td:has-text("ПАО Сбербанк")').first().click();
  await page.waitForTimeout(1000);
  await shot(
    page,
    '05-drawer',
    'Панель контрагента справа: реквизиты в порядке платёжного поручения, назначение по умолчанию, кто и когда добавил. Внизу — «Изменить», «В архив» и «Удалить»: контрагента из неоплаченного планового расхода удалить нельзя, только убрать в архив.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Реквизиты').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );
};
