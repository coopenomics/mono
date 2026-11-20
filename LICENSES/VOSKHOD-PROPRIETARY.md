# ЗАКРЫТАЯ ЛИЦЕНЗИЯ на программы для ЭВМ «Стол заказов», «Благорост» и «Образование»

**Все права защищены**

Редакция от 19.11.2026

© 2024–2026 Потребительский кооператив «ВОСХОД» (ОГРН 1247700283346, ИНН 9728130611)

## 1. Общие положения

1.1. Настоящая Закрытая лицензия устанавливает условия, на которых исходный код программ для ЭВМ «Стол заказов», «Благорост» и «Образование» (далее — Приложения) размещён в репозитории программного обеспечения «Цифровой Кооператив» (далее — Репозиторий).

1.2. Исключительное право на Приложения принадлежит Потребительскому кооперативу «ВОСХОД» (далее — Правообладатель).

1.3. Приложения охраняются как программы для ЭВМ в соответствии со статьёй 1261 Гражданского кодекса Российской Федерации (далее — ГК РФ).

## 2. Состав Приложений

2.1. Приложение «Стол заказов» составляет исходный код в следующих каталогах Репозитория:

1) `components/desktop/extensions/market`;
2) `components/desktop/src/entities/MarketplaceAplReception`;
3) `components/desktop/src/entities/MarketplaceCart`;
4) `components/desktop/src/entities/MarketplaceHandoff`;
5) `components/desktop/src/entities/MarketplaceInventory`;
6) `components/desktop/src/entities/MarketplaceInvestment`;
7) `components/desktop/src/entities/MarketplaceKUDetails`;
8) `components/desktop/src/entities/MarketplaceOffer`;
9) `components/desktop/src/entities/MarketplaceOrder`;
10) `components/desktop/src/entities/MarketplaceReview`;
11) `components/desktop/src/entities/MarketplaceStorage`;
12) `components/desktop/src/entities/MarketplaceSupplierProfile`;
13) `components/desktop/src/entities/MarketplaceSupplierSettings`;
14) `components/desktop/src/features/Marketplace`;
15) `components/desktop/src/features/MarketplaceDetailKU`;
16) `components/desktop/src/pages/Marketplace`;
17) `components/desktop/src/shared/lib/marketplace`;
18) `components/desktop/src/widgets/Marketplace`;
19) `components/controller/src/extensions/marketplace`;
20) `components/controller/tests/unit/marketplace`;
21) `components/api-tests/src/marketplace`;
22) `components/docs-harness/scenarios/marketplace`.

2.2. В состав приложения «Стол заказов» входят также следующие файлы Репозитория:

1) `components/desktop/src/shared/i18n/locales/ru/marketplace.json`;
2) `components/desktop/src/shared/i18n/locales/ru/marketplaceDetailKU.json`;
3) `components/desktop/src/shared/i18n/locales/ru/marketplaceStorage.json`;
4) `components/desktop/src/shared/lib/consts/marketplace-units.ts`;
5) `components/desktop/src/shared/lib/utils/marketplaceOfferImages.ts`;
6) `components/desktop/src/app/styles/marketplace-tokens.scss`.

2.3. Приложение «Благорост» составляет исходный код в следующих каталогах Репозитория:

1) `components/desktop/extensions/capital`;
2) `components/controller/src/extensions/capital`;
3) `components/controller/tests/unit/capital`;
4) `components/api-tests/src/capital`.

2.4. Приложение «Образование» составляет исходный код в следующих каталогах Репозитория:

1) `components/desktop/extensions/edubridge`;
2) `components/controller/src/extensions/edubridge`;
3) `components/controller/tests/unit/edubridge`;
4) `components/api-tests/src/edubridge`;
5) `components/docs-harness/scenarios/edubridge`.

2.5. Смарт-контракты Приложений в каталогах `components/contracts/cpp/marketplace`, `components/contracts/cpp/capital` и `components/contracts/cpp/edubridge` в состав Приложений по настоящей Закрытой лицензии не входят. Смарт-контракты распространяются на условиях, указанных в файле `components/contracts/LICENSE`.

## 3. Использование Приложений

3.1. Размещение исходного кода Приложений в Репозитории не является предоставлением права использования Приложений, публичной офертой или открытой лицензией по статье 1286.1 ГК РФ.

3.2. Отсутствие запрета не считается согласием (разрешением) Правообладателя (абзац второй пункта 1 статьи 1229 ГК РФ).

3.3. Лицо, получившее доступ к Репозиторию, вправе просматривать исходный код Приложений в Репозитории.

3.4. Без письменного разрешения Правообладателя не допускаются следующие способы использования Приложений:

1) воспроизведение, в том числе запись в память ЭВМ, установка на сервер и запуск;
2) распространение, в том числе в составе другой программы для ЭВМ или образа контейнера;
3) переработка, в том числе модификация и создание производной программы для ЭВМ;
4) доведение до всеобщего сведения и иное предоставление доступа к Приложениям третьим лицам;
5) использование Приложений для оказания услуг третьим лицам, в том числе в форме удалённого доступа через сеть «Интернет».

3.5. Правообладатель предоставляет право использования Приложений по лицензионному договору о предоставлении простой (неисключительной) лицензии (статьи 1235, 1236 и 1286 ГК РФ).

3.6. Лицензионный договор заключается в письменной форме (пункт 2 статьи 1235 ГК РФ), в том числе в упрощённом порядке (пункт 5 статьи 1286 ГК РФ).

3.7. Копия Приложения, изготовленная без разрешения Правообладателя, не является правомерно приобретённым экземпляром программы для ЭВМ в смысле статьи 1280 ГК РФ.

3.8. Использование Приложений без лицензионного договора является незаконным и влечёт ответственность, установленную ГК РФ, в том числе выплату компенсации по статье 1301 ГК РФ.

## 4. Соотношение с иными лицензиями Репозитория

4.1. Лицензия MIT и лицензия Creative Commons «Attribution-NonCommercial-ShareAlike 4.0 International», установленные для иных частей Репозитория, на Приложения не распространяются.

4.2. Программы для ЭВМ сторонних правообладателей, которые Приложения используют как зависимости, распространяются на условиях лицензий этих правообладателей.

## 5. Заключительные положения

5.1. Правообладатель вправе изменить настоящую Закрытую лицензию путём размещения новой редакции в Репозитории.

5.2. К отношениям, связанным с использованием Приложений, применяется право Российской Федерации.

5.3. Споры, связанные с использованием Приложений, разрешаются в порядке, установленном законодательством Российской Федерации.

5.4. Обращения о заключении лицензионного договора направляются Правообладателю по адресу электронной почты support@coopenomics.world.

## 6. Реквизиты Правообладателя

Потребительский кооператив «ВОСХОД»
ОГРН 1247700283346, ИНН 9728130611, КПП 772801001
Адрес: 117593, г. Москва, Соловьиный проезд, д. 1, помещ. 1/1
Электронная почта: support@coopenomics.world
