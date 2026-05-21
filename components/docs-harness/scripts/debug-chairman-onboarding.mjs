// Diagnostic: log in as chairman of Voskhod and dump DOM structure of all
// onboarding portal dialogs. Output goes to stdout — no shots, no side effects.

import { openBrowser, env } from '../lib/harness.mjs';

const { browser, page } = await openBrowser();
page.on('console', (m) => console.log(`[browser ${m.type()}]`, m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
try {
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 30_000 });
  await page.locator('label:has-text("электронную почту")').first().locator('input').fill(env.CHAIRMAN_EMAIL);
  await page.locator('label:has-text("ключ доступа")').first().locator('input').fill(env.CHAIRMAN_WIF);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/\/(chairman|participant|soviet)/, { timeout: 30_000 });
  console.log('logged in url:', page.url());

  // Подождём пока всё подгрузится (агрименты, шаблоны)
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // Снимок 1: спустя 5 сек после логина
  const dump = async (label) => {
    const data = await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'));
      return portals.map((p) => {
        const visible = getComputedStyle(p).display !== 'none';
        const title = p.querySelector('.q-toolbar__title, .modal-base__title, h1, h2, h3, h4')?.textContent?.trim() || null;
        const loaderText = p.querySelector('.loader, [class*="loader"], .q-spinner')
          ? (p.textContent?.match(/Формируем[^\n]+/) ?? [null])[0]
          : null;
        const buttons = Array.from(p.querySelectorAll('button')).map((b) => ({
          text: b.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
          disabled: b.disabled,
          loading: b.classList.contains('q-btn--loading'),
          classes: b.className.slice(0, 80),
        }));
        const headerText = (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        return { id: p.id, visible, title, loaderText, buttons, headerText };
      });
    });
    console.log(`\n=== ${label} (${data.length} portals) ===`);
    for (const d of data) {
      console.log(JSON.stringify(d, null, 2));
    }
  };

  await dump('t=5s');
  await page.waitForTimeout(15000);
  await dump('t=20s');

  // Если хоть один портал виден — попробуем разные стратегии нативного клика по «Подписать»
  // во всех видимых порталах, посмотрим что произойдёт.
  // Логируем browser-console для диагностики.
  page.on('console', (m) => console.log(`[browser ${m.type()}]`, m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  console.log('\n=== inspect button HTML & form structure ===');
  const inspect = await page.evaluate(() => {
    const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
      .filter((p) => getComputedStyle(p).display !== 'none');
    if (!portals.length) return null;
    const p = portals[0];
    const btn = Array.from(p.querySelectorAll('button'))
      .find((b) => (b.textContent || '').includes('Подписать') && !b.disabled);
    if (!btn) return null;
    const form = btn.closest('form');
    return {
      btnOuterPreview: btn.outerHTML.slice(0, 400),
      btnType: btn.type,
      btnFormAttr: btn.getAttribute('form'),
      formExists: !!form,
      formClasses: form?.className,
      formId: form?.id,
    };
  });
  console.log(JSON.stringify(inspect, null, 2));

  console.log('\n=== патчим Pinia useAgreementStore.signAgreement чтобы видеть вызов ===');
  // Воткнём шпиона: переопределим методы submit, посмотрим вызовы.
  await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form.q-form'));
    forms.forEach((f, i) => {
      f.addEventListener('submit', (ev) => {
        console.log(`[FORM SUBMIT ${i}] portal=${f.closest('[id^="q-portal--dialog--"]')?.id} default=${ev.defaultPrevented}`);
      }, true); // capture
    });
  });

  console.log('\n=== попытка через playwright .click() ПЕРВОГО портала, then wait long ===');
  const portalIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
      .filter((p) => getComputedStyle(p).display !== 'none')
      .map((p) => p.id),
  );
  console.log('visible portals before click:', portalIds);
  if (portalIds.length) {
    const firstId = portalIds[0];
    const btn = page.locator(`#${firstId} button:has-text("Подписать")`).first();
    await btn.click({ force: true, timeout: 5_000 }).then(() => console.log('click1 OK')).catch((e) => console.log('click1 FAIL', e.message.slice(0, 200)));

    // Долгий wait + периодический дамп
    for (let s = 1; s <= 6; s++) {
      await page.waitForTimeout(5000);
      const stateNow = await page.evaluate(() => {
        const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
          .filter((p) => getComputedStyle(p).display !== 'none');
        const top = portals[0];
        const btn = top ? Array.from(top.querySelectorAll('button')).find((b) => (b.textContent || '').includes('Подписать')) : null;
        return {
          visiblePortals: portals.length,
          topId: top?.id,
          btnDisabled: btn?.disabled,
          btnLoading: btn?.classList.contains('q-btn--loading'),
        };
      });
      console.log(`t=${s * 5}s after click1:`, JSON.stringify(stateNow));
    }
  }
  await dump('t=final');

  console.log('\nurl after clicks:', page.url());
} catch (e) {
  console.error('debug failed:', e.message, e.stack);
} finally {
  await browser.close();
}
