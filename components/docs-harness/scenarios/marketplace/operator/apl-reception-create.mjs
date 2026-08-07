// Сценарий: operator-стол «Приёмка партии» (Эпик 5 / Story 5.6).
// Председатель КУ открывает акт приёмки (registry_id=1102) против
// ожидаемой поставки. После backend-фикса acceptIndividual
// (синтез cycle+shipment) индивидуальные заказы образуют SUPPLY_PREPARED
// shipment вариант A автоматически — оператор открывает АПП по нему.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

function fetchLatestPreparedShipmentId() {
  // Канон: оператор знает id партии из накладной / звонка поставщика.
  // Harness достаёт самый свежий SUPPLY_PREPARED shipment, чтобы не тащить
  // его через UI поставщика (страница OffererSupplyPreparationPage пока
  // read-only, без виджета grouping; production UX-итерация подключит
  // ExpeditorGroupingBoard).
  try {
    const out = execSync(
      `docker exec mono-ai-4-postgres-1 psql -U postgres -d voskhod -tA -c "SELECT id FROM marketplace_shipment WHERE status='SUPPLY_PREPARED' ORDER BY created_at DESC LIMIT 1;"`,
      { encoding: 'utf8' },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

export const meta = {
  title: 'Стол ПВЗ — приёмка партии',
  docPath: 'new/marketplace/operator/apl-reception-create.md',
  assetsDir: 'assets/new/marketplace/operator/apl-reception-create',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('chairkrg');
  // Канон: председатель КУ Красногорск получает marketplace-роль
  // `operator` (см. marketplace-roles.mapper.ts isKuChairman). У обычного
  // operator-пайщика (opkrg) этой роли нет — попытка приёмки от него
  // упирается в MarketplaceRoleGuard. Фронт-роутер пропускает по
  // core-role `chairman` (chairkrg = branch chairman своего КУ).
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  // chairkrg — свежая фикстура: при первом входе рендерится каскад из 4
  // SignAgreementDialog (Цифровой Кошелёк / ЭП / ПД / пользовательское),
  // чьи q-portal--dialog--N перехватывают клики по форме приёмки. Убираем
  // их DOM-hack'ом (канон harness: вызываем после login и каждой навигации).
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/reception`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-reception-empty',
    'Стол «Приёмка партии» председателя КУ. URL: `' + page.url() + '`. До создания АПП — поля «ID КУ» и «ID партии» пустые, таблица актов внизу пустая.',
  );

  const shipmentId = fetchLatestPreparedShipmentId();
  if (!shipmentId) {
    console.warn('  ⚠️  Нет SUPPLY_PREPARED shipment\'ов в БД — сценарий ограничится empty state');
    return;
  }

  // Шаг 5 magistral II: оператор вводит ID партии и создаёт АПП приёмки.
  // На UI используется button «Создать АПП»; backend mutation
  // marketplaceCreateAplReception проверяет Shipment.status===SUPPLY_PREPARED,
  // создаёт акт со status PENDING_SUPPLIER_SIGN и переводит Shipment →
  // RECEPTION_IN_PROGRESS.
  const shipmentInput = page.locator('label:has-text("ID партии")').locator('input').first();
  await shipmentInput.click({ clickCount: 3 });
  await shipmentInput.fill(shipmentId);
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-shipment-id-pasted',
    'Оператор КУ вводит ID партии поставщика (`' + shipmentId.slice(0, 8) + '...`). В production-UX этот идентификатор приходит на стойку оператора через сопроводительную ТТН (Вариант Б) или устно от поставщика (Вариант А).',
  );

  const createBtn = page.locator('button:has-text("Создать АПП")').first();
  await createBtn.click();

  // Ждём Notify «Акт приёмки создан» (positive).
  await page.waitForFunction(
    () => {
      const notifs = document.querySelectorAll('.q-notification__message');
      for (const n of notifs) {
        if ((n.textContent || '').includes('Акт приёмки создан')) return true;
      }
      return false;
    },
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);

  // Подгружаем список актов в этом КУ (поле «ID кооперативного участка»).
  const branameInput = page.locator('label:has-text("ID кооперативного участка")').locator('input').first();
  await branameInput.click({ clickCount: 3 });
  await branameInput.fill('krg');
  await page.waitForTimeout(300);
  const loadBtn = page.locator('button:has-text("Загрузить АПП")').first();
  await loadBtn.click();
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-reception-created',
    'После клика «Создать АПП»: Notify «Акт приёмки создан» (positive). Загрузив АПП по `braname=krg`, видим новую запись в таблице — Вариант А, статус PENDING_SUPPLIER_SIGN, сумма по группе. Shipment → RECEPTION_IN_PROGRESS, on-chain `signsupp` ждёт первую подпись поставщика (шаг 6 магистрали II).',
    { preserveNotifications: true },
  );
};
