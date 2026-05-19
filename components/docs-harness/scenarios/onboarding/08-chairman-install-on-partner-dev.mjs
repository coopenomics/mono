// Сценарий: председатель Партнёра-1 проходит установочный wizard на partner-dev.
//
// Контекст. После 05-activate-from-registry оператор Восхода отправил
// `Union/InstallCooperative` tx и provider развернул partner1.coopenomics.world
// (partner-dev в dev-loop'е). На partner-dev mono-status=install,
// init_by_server=true (orgdata уже предзаполнены через is_server_init=true
// со стороны провайдера).
//
// Wizard состоит из 4 шагов (см. pages/Union/InstallCooperative/InstallCooperativePage.vue):
//   1. key    — RequestKeyForm: WIF активного ключа пайщика (partner1)
//   2. init   — SetInitForm: readonly orgdata, "Далее"
//   3. soviet — SetSovietForm: председатель + минимум 1 член совета
//   4. vars   — SetVariablesForm: ОПФ+, устав, email конфиденциальности
//
// Submit на шаге vars → install() мутация → soviet::create on-chain →
// SystemStatus.active → invite-токены каждому члену совета через Novu.
//
// Перехват WIF chairman'а отдельным сценарием 09 (через invite-token из БД
// partner1 — Novu не доставит email на @example.com адреса).

import { env } from '../../lib/harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARTNER_FIXTURE = JSON.parse(
  readFileSync(resolve(__dirname, '../../state/cooperatives/partner1.json'), 'utf-8'),
);

export const meta = {
  title: 'Председатель Партнёра-1 проходит установочный wizard на partner-dev',
  docPath: 'new/onboarding/08-chairman-install-on-partner-dev.md',
  assetsDir: 'assets/new/onboarding/08-chairman-install-on-partner-dev',
  role: 'partner-chairman',
};

// Данные председателя для шага soviet. На @example.com Novu не доставит
// инвайт, но bcrypt-токен сохранится в БД partner1 и его можно достать
// напрямую (см. сценарий 09).
const CHAIRMAN_INDIVIDUAL = {
  email: 'chairman.partner1@example.com',
  first_name: 'Иван',
  last_name: 'Иванов',
  middle_name: 'Иванович',
  birthdate: '1990-01-01',
  phone: '+7 (901) 123-45-67',
  full_address: 'г. Москва, ул. Тестовая, д. 1, оф. 100',
};

export default async ({ page, shot }) => {
  console.log(`[08] base=${env.BASE_URL} coop=${env.COOPNAME}`);

  // ---- шаг 1: ключ установки ---------------------------------------------
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/install`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForSelector('label:has-text("Ключ установки")', { timeout: 30_000 });
  await shot(
    page,
    '01-step-key',
    'Шаг 1 — «Введите ключ установки». На partner-dev mono-status=install: председатель вводит WIF активного ключа аккаунта partner1, который он получил при регистрации на Восходе.',
  );

  await page.locator('label:has-text("Ключ установки")').locator('input').fill(PARTNER_FIXTURE.wif);
  await page.locator('button:has-text("Продолжить")').click();
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  // ---- шаг 2: init (readonly если init_by_server=true) -------------------
  // SetInitForm — после успешного startInstall (wif → vault) показывает либо
  // readonly orgdata (is_server_init=true), либо форму ввода (false).
  await page.waitForFunction(
    () => {
      const next = Array.from(document.querySelectorAll('button')).find((b) =>
        /Далее|Продолжить/i.test(b.textContent || ''),
      );
      return !!next;
    },
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1500);
  await shot(
    page,
    '02-step-init-readonly',
    'Шаг 2 — «Инициализация системы». Данные кооператива пришли с провайдера через is_server_init=true, поля readonly. Председатель сверяет и жмёт «Далее».',
  );

  // На readonly-форме кнопка «Далее». На неreadonly — «Продолжить». В обоих
  // случаях текст-фильтр найдёт активную кнопку для перехода на soviet.
  const nextBtn = page.locator('button:has-text("Далее"), button:has-text("Продолжить")').last();
  await nextBtn.click({ force: true });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  // ---- шаг 3: soviet -----------------------------------------------------
  await page.waitForSelector('label:has-text("Электронная почта")', { timeout: 30_000 });
  await shot(
    page,
    '03-step-soviet-empty',
    'Шаг 3 — «Члены совета». Wizard всегда стартует с одной пустой карточкой Председателя совета.',
  );

  // Заполняем председателя. IndividualDataForm полей много; заполним только
  // обязательные. Если форма требует больше — wizard покажет ошибку на
  // submit, можно будет добавить.
  const fillField = async (label, value) => {
    const loc = page.locator(`label:has-text("${label}")`).first().locator('input');
    if (await loc.count()) {
      await loc.fill(value, { timeout: 5_000 });
    }
  };
  await fillField('Электронная почта', CHAIRMAN_INDIVIDUAL.email);
  await fillField('Имя', CHAIRMAN_INDIVIDUAL.first_name);
  await fillField('Фамилия', CHAIRMAN_INDIVIDUAL.last_name);
  await fillField('Отчество', CHAIRMAN_INDIVIDUAL.middle_name);
  await fillField('Дата рождения', CHAIRMAN_INDIVIDUAL.birthdate);
  await fillField('Телефон', CHAIRMAN_INDIVIDUAL.phone);
  await fillField('Адрес', CHAIRMAN_INDIVIDUAL.full_address);
  await page.waitForTimeout(500);

  await shot(
    page,
    '04-step-soviet-filled',
    'Шаг 3 — карточка председателя заполнена. На MVP-сценарий ограничились одним председателем (минимум — он же; обычные кооперативы добавляют 2-3 членов совета).',
  );

  await page.locator('button:has-text("Продолжить")').last().click({ force: true });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

  // ---- шаг 4: vars -------------------------------------------------------
  await page.waitForSelector('label:has-text("Собственное наименование кооператива")', { timeout: 30_000 });
  await page.waitForTimeout(800);

  await fillField('Собственное наименование кооператива', 'Партнёр-1');
  await fillField('ОПФ+ в именительном падеже', 'Потребительский Кооператив');
  await fillField('ОПФ+ в родительном падеже', 'Потребительского Кооператива');
  await fillField('ОПФ+ в дательном падеже', 'Потребительскому Кооперативу');
  await fillField('Краткая аббревиатура ОПФ+', 'ПК');
  await fillField('Ссылка на устав кооператива', 'https://partner1.coopenomics.world/statute.pdf');
  await fillField('Email по вопросам конфиденциальности', 'privacy.partner1@example.com');
  await page.waitForTimeout(500);

  await shot(
    page,
    '05-step-vars-filled',
    'Шаг 4 — «Переменные документов». Заполнены ОПФ+ во всех падежах, ссылка на устав и контакт по вопросам конфиденциальности.',
  );

  await page.locator('button:has-text("Завершить установку")').click({ force: true });

  // ---- финал: дождаться is_finish ---------------------------------------
  // На success — Vue показывает completion-section с «Установка завершена».
  // На fail — q-notification с FailAlert.
  const FINISH_TIMEOUT = 90_000;
  try {
    await page.waitForSelector('.completion-title:has-text("Установка завершена")', {
      timeout: FINISH_TIMEOUT,
    });
    await page.waitForTimeout(1500);
    await shot(
      page,
      '06-completed',
      'Финальный экран — «Установка завершена». На on-chain создан soviet через soviet::create; членам совета отправлены invite-токены. Председатель переходит к «Войти в систему» после получения WIF из invite-ссылки.',
    );
  } catch (e) {
    // Submit упал (вероятно subscriber_id для Novu не сгенерён, либо
    // организационные данные на init не сохранились). Снимаем шот ошибки.
    await shot(
      page,
      '06-error-state',
      `Submit «Завершить установку» не дошёл до экрана is_finish за ${FINISH_TIMEOUT / 1000}с — см. q-notification и/или console.log сценария.`,
    );
    throw e;
  }
};
