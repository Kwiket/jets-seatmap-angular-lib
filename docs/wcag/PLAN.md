# Plan: WCAG 2.2 AA для `jets-seatmap-angular-lib`

> **Source of truth:** `docs/wcag/PLAN.md` в репозитории `jets-seatmap-angular-lib`, ветка `WCAG`. Эта копия (`~/.claude/plans/sprightly-roaming-tide.md`) — рабочая для текущей Claude-сессии. Любые правки прогресса делаются в **обоих местах синхронно**, и репозиторная копия коммитится с понятным сообщением, чтобы все агенты/сессии видели актуальное состояние.
>
> **Cross-session protocol:**
> 1. В начале каждой новой сессии — `cd jets-seatmap-angular-lib && git pull && cat docs/wcag/PLAN.md` (или Read через инструменты). Перечитать секции «Status», «Progress tracking», «Decisions log», «Open questions».
> 2. Текущий focus указан в «Status» — продолжать оттуда.
> 3. После каждого выполненного коммита: отметить чекбокс в «Progress tracking», добавить SHA коммита, обновить «Status.Next», запушить.
> 4. Решения, принятые при выборе из вариантов в плане — фиксировать в «Decisions log» с датой.

---

## Status

- **Last updated:** 2026-06-16 — **Phase 2 завершена: WCAG-фичи переведены на opt-in флаги и портированы поверх свежего `main`.** Работа ведётся в ветке `wcag-port-main` (95 коммитов поверх Phase 1 tip `30038c8`). Все 17 a11y-коммитов теперь спрятаны за `config.wcag: IWcagConfig`, **по умолчанию выключены** — без явного opt-in библиотека байт-в-байт совпадает с `main` (нулевой визуальный diff подтверждён snapshot-сравнением, см. ниже). Дальше — свернуть `wcag-port-main` в `WCAG` (fast-forward), затем пользователь руками чистит устаревшие ветки через GitHub.
- **Phase 1 (2026-06-05, branch `WCAG`, tip `30038c8`):** 🎉 ВСЕ 17 КОММИТОВ ЗАВЕРШЕНЫ. Wave G: commit 17 (`README + ACR + CHANGELOG`, SHA `5d3a35a`) и commit 16 (`axe + keyboard tests`, SHA `9a9ab70`). ACR покрывает 59 SC (0 «Does not support», 2 «Partially supports» из-за host responsibility). Unit-набор: 476/476 зелёные. E2E a11y-набор: 3/3 зелёные. В Phase 1 все a11y-фичи были включены по умолчанию (visual/DOM-breaking для consumers).
- **Phase 2 (2026-06-16, branch `wcag-port-main`, tip `2edf176`):** merge свежего `main` (React-parity фиксы) + рефактор на флаги. Новый `IWcagConfig` (types.ts) с per-feature флагами, все default `false`: `enabled` (общий шорткат), `defaultColorTheme`, `liveAnnouncer`, `visibleRestrictionReason`, `landmarksAndSkipLink`, `gridSemantics`, `keyboardNavigation` (требует `gridSemantics`), `tooltipDialog`, `alternativeView`. AA-палитра вынесена в `WCAG_COLOR_THEME` и подмешивается только при `defaultColorTheme` (commit `868df0a`, «defer WCAG palette via wcagPalette plumbing»). Snapshot-comparison harness — `projects/seatmap-demo/e2e/comparison/` (commit `2edf176`), env `$WCAG_PRESET` = `off` / `mid` / `on`. **Сравнение прогнано и пройдено 2026-06-16:** пресет `off` даёт нулевой diff с `origin/main`. Повторный прогон не нужен.
- **Orchestration mode active:** Claude как orchestrator. Подробности — Claude memory `project_wcag_orchestration` и `project_wcag_sub_agent_constraints`.
- **Current wave:** нет — Phase 1 и Phase 2 завершены. Следующий шаг — fast-forward ветки `WCAG` на `wcag-port-main` (чистый ff, 95 коммитов, 0 потерь), после чего стейкхолдеры ревьюят `WCAG`, merge в `main`, релиз.
- **Pre-existing e2e flakes** (зафиксировано суб-агентами Wave C на baseline `9eb0b26`): `colorTheme · field-seatArmrestColor`, `colorTheme · field-seatStrokeWidth`, `customCabinTitles · default`, `customCabinTitles · short`. Проходят в изолированном single-worker запуске, ломаются на параллельных воркерах. Не связаны с WCAG-работой; разбирать отдельно после ветки.
- **Blockers:**
  - ⚠ Baseline при запуске `vitest run` напрямую падает с `TestBed.initTestEnvironment() first` — init-testbed setup инжектируется только через `ng test`. Тесты гонять командой `npm test -- --watch=false` / `ng test seatmap-lib --watch=false`, **не** `vitest run` напрямую.
  - ⚠ Sub-агенты не могут `git push origin HEAD:WCAG` — harness блокирует push в shared-branch от не-orchestrator-сессии. Orchestrator интегрирует их коммиты сам (fetch+rebase+push из worktree).
  - ⚠ E2E (Playwright) требует `.env.local` в корне worktree с реальными API-ключами sandbox'а. Без этого `prestart → generate:env` пишет пустой `__env`, и все тесты валятся с `HTTP 200: parsing /auth`. Orchestrator должен симлинковать/копировать `.env.local` из main checkout при создании worktree.
  - ⚠ Удалить вспомогательные `origin/wcag-commit-N` ветки harness тоже запрещает. Безвредны — оставляем как есть.
  - ⚠ **Long-running sub-agents падают по stream-timeout** (~115 мин run-time). Wave D показала: для крупных задач (новый компонент + интеграция + spec) prompt лучше делить на 2 узких suba — или orchestrator принимает partial work и дописывает сам. Это уже произошло на commits 6 и 13.

## Context

Цель — привести Angular-библиотеку `jets-seatmap-angular-lib` (publishable lib + demo-приложение) к WCAG 2.2 уровня AA, с WCAG 2.1 AA как обязательным минимумом, так чтобы можно было выпустить ACR/VPAT. Сейчас компонент карты мест полностью недоступен с клавиатуры, не содержит ARIA-семантики, не имеет focus-стилей, не поддерживает screen reader и нарушает критерии 1.1.1, 1.3.1, 1.4.10, 1.4.11, 1.4.13, 2.1.1, 2.4.1, 2.4.3, 2.4.7, 2.4.11, 2.5.8, 3.3.1, 3.3.3, 4.1.2, 4.1.3.

Работа ведётся в репозитории `/Users/andrey.vilchinsky/work/seatmaps/Angular/jets-seatmap-angular-lib`, ветка `WCAG` (создана от `main`, fast-forwarded на `db00aec`). Стек: Angular 21.2, standalone-компоненты, OnPush, Vitest для unit, Playwright для e2e. `@angular/cdk` не подключён.

Публичный API `JetsSeatMapComponent` (селектор `sm-jets-seat-map`, ~30 @Input/@Output) — это контракт, ломать нельзя. Все изменения должны быть аддитивными: новые опциональные `@Input` ок, новые `@Output` ок, изменения DOM-структуры — допустимы пока сохраняются CSS-классы и `data-*` атрибуты, на которые могли завязаться consumers.

---

## Gap-анализ по критериям WCAG 2.2 A/AA

| Критерий | Текущий статус | Что требуется |
|---|---|---|
| 1.1.1 Non-text content (A) | FAIL | Декоративные SVG (фюзеляж, крылья, разделители, иконки удобств) — `aria-hidden="true"`. Функциональные графики — accessible name на seat-кнопке. |
| 1.3.1 Info & Relationships (A) | FAIL | Grid-семантика: `role="grid"` на контейнере палубы, `role="row"` с `aria-rowindex` на рядах, `role="gridcell"` с `aria-colindex` на местах. `aria-selected`, `aria-disabled`, `aria-rowcount`, `aria-colcount`. |
| 1.4.1 Use of Color (A) | PARTIAL | Уже есть `seatUnavailableCrossColor` (крест). Добавить: всегда (если тема включает крест) рендерить крест; checkmark / passenger badge для selected — уже есть; легенда уже использует `icon: 'cross'/'checkmark'`. Документировать в README, что крест-иконка обязательна. |
| 1.4.3 Contrast text (AA) | FAIL | Дефолтные токены `DEFAULT_COLOR_THEME` (constants.ts:120-185) не проверены на 4.5:1. Пересчитать seatLabelColor поверх seatAvailableColor / seatSelectedColor / seatPreferredColor / seatExtraColor / notAvailableSeatsColor. Disabled-состояние использует `opacity: 0.6` (jets-seat.component.scss) — заменить на дискретный токен. |
| 1.4.10 Reflow (AA) | EXEMPT | Карта самолёта — двумерная диаграмма, попадает под исключение «2D layout required for meaning». Формально 1.4.10 не нарушается. Но **2.5.8 требует target-size**, для чего нужен list view (см. ниже). |
| 1.4.11 Non-text contrast (AA) | FAIL | Focus-ring 2px solid с контрастом ≥3:1. Selected-stroke (если использовался) ≥3:1. Бордюр между unavailable и available состояниями ≥3:1. |
| 1.4.13 Content on hover/focus (AA) | FAIL | `tooltipOnHover` не открывает тултип на keyboard `focusin`; `onSeatMouseLeave` мгновенно закрывает тултип при движении курсора к нему (не hoverable); нет Esc. Исправить: открывать на focus, закрывать с задержкой при leave, держать открытым пока курсор/фокус в тултипе, Esc закрывает. |
| 2.1.1 Keyboard (A) | FAIL | Полная клавиатурная навигация по grid: Arrow/Home/End/Ctrl+Home/Ctrl+End/PageUp/PageDown/Enter/Space/Esc. Tooltip: Tab по кнопкам, Esc закрывает. |
| 2.1.2 No keyboard trap (A) | PASS | Текущий код не имеет trap. Сохранить: tooltip — non-modal, Tab выходит наружу естественно. |
| 2.4.1 Bypass blocks (A) | FAIL | `<section role="region" aria-labelledby>` + cdk-visually-hidden heading + skip-link на якорь после grid. |
| 2.4.3 Focus order (A) | N/A | После grid — один tab-стоп в карту (roving). Порядок: deck selector → grid → tooltip (когда открыт) → следующий элемент за skip-link. |
| 2.4.7 Focus visible (AA) | FAIL | `:focus-visible { outline: 2px solid; outline-offset: 2px; }` на seat-button, tooltip-buttons, deck-selector. |
| 2.4.11 Focus not obscured (AA) | UNCERTAIN | При открытии тултипа над выбранным местом — позиционирование уже учитывает `openBelow`, но не учитывает sticky-headers хоста. Документировать как host-responsibility. Внутри библиотеки — гарантировать `scrollIntoView` на фокусированную ячейку. |
| 2.5.7 Dragging (AA) | N/A | Драга нет в библиотеке. |
| 2.5.8 Target size (AA) | UNCERTAIN | Минимум 24×24 CSS px на seat-button. При сильно широкой компоновке (много мест в ряду на узкой ширине) ячейки могут стать меньше — list view как альтернативный путь. |
| 3.3.1 Error identification (A) | FAIL | Disabled select-кнопка в тултипе (когда `isSelectDisabled()` true) не сообщает причину. |
| 3.3.3 Error suggestion (AA) | FAIL | Аналогично — нет подсказки альтернативы. |
| 4.1.2 Name, Role, Value (A) | FAIL | Seat сейчас `<div>` без role/name. Стать `<button type="button">` с `aria-label`, `aria-selected`, `aria-disabled` (не нативный disabled), `aria-describedby` для конфликтов. |
| 4.1.3 Status messages (AA) | FAIL | `LiveAnnouncer` (polite): «Seat 14C selected, €12», «Seat 14C unselected», «Seat 14C not available for infant passenger», «Jumped to seat 14C». Итоговая сумма — НЕ ответственность библиотеки (host реализует). |

---

## Целевая архитектура

### Grid-семантика (полный Grid pattern с двухскоростной навигацией)

`role="grid"` на контейнере палубы (per-deck, не на корне), `role="row"` с `aria-rowindex` на каждом ряду (включая ряды-разделители кабин — у них `aria-label="…cabin boundary"`), `role="gridcell"` на каждой позиции в ряду (включая `aisle`/`empty`/`unavailable`). Это соответствует APG Layout Grid pattern: каждая ячейка достижима фокусом.

- **Все ячейки `gridcell` имеют tabindex (roving):** один с `tabindex="0"`, остальные `tabindex="-1"`.
- **Unavailable seats** — `<button>` без HTML-атрибута `disabled` (он убирает focusability), а с `aria-disabled="true"`. Обработчик клика/Enter — no-op, но focus и aria-label («14B, middle, unavailable») работают.
- **Aisle / empty** — non-button (`<div role="gridcell" tabindex="-1" aria-label="aisle">`), не активируются, но достижимы стрелками для сохранения геометрии.
- **Skim-mode:** Ctrl+ArrowLeft/Right — прыжок только по interactable seats (skip aisle/empty/unavailable). PageUp/PageDown — ±5 рядов по interactable. Это закрывает UX-проблему «много пустых ячеек».

### Roving + 2D keyboard navigation

CDK `FocusKeyManager` одномерный, для 2D-сетки реализовать вручную в новом сервисе `SeatGridNavigationService` (или прямо в `JetsSeatMapComponent`, если состояние небольшое).

Состояние: `focusedCell: { deckIdx, rowIdx, colIdx }`. Хранится в компоненте. Изменяется через keydown handler на контейнере grid. На каждое изменение — пересчёт `tabindex` через input в seat-компонент (или imperative `focus()` через `ViewChild` / `data-seat-number` querySelector — последнее уже используется для `_jumpToSeat`, переиспользуем).

Биндинги:
- `ArrowLeft/Right`: ±1 column в текущем ряду, обтекая non-existent позиции.
- `ArrowUp/Down`: ±1 row, ищем ближайшую column в новом ряду (по leftOffset).
- `Home`: первая ячейка ряда.
- `End`: последняя ячейка ряда.
- `Ctrl+Home`: первая interactable ячейка карты.
- `Ctrl+End`: последняя interactable ячейка карты.
- `PageUp/Down`: ±5 рядов с поиском ближайшей interactable column.
- `Ctrl+ArrowLeft/Right`: skim — следующая interactable ячейка в направлении.
- `Enter`/`Space`: активация (открыть tooltip или toggle selection — текущий `onSeatClick` flow).
- `Esc`: если открыт tooltip — закрыть, фокус остаётся на seat. Иначе — no-op (или передать в onkeydown bubbling).

### Tooltip как non-modal dialog

- `role="dialog"` **без** `aria-modal="true"` (карта не оверлится, клик снаружи закрывает — `onMapClick` уже это делает).
- `aria-labelledby` на заголовок (seat name + number).
- `aria-describedby` на amenities-блок и (при наличии) на причину `seatRestrictionMessage`.
- **Без `cdkTrapFocus`** — это сломало бы `onMapClick`-flow.
- Авто-фокус на primary action: «Select» если доступна; «Unselect» если место уже занято; иначе «Cancel».
- `keydown.escape` на корне тултипа — `close.emit()`.
- При закрытии — фокус возвращается на seat-кнопку-триггер (через `ViewChild` или хранение `lastTriggerElement` в JetsSeatMapComponent).
- `sidePanel` вариант (`jets-tooltip.component.ts:32`) — не dialog, а `role="region"` с `aria-labelledby`, без auto-focus и фокус-восстановления (это inline-секция страницы).

### LiveAnnouncer

CDK `LiveAnnouncer` (через `@angular/cdk/a11y`). Внедряется в `JetsSeatMapComponent`. Вещает:
- `onTooltipSelect`: `"Seat {number} selected for {passengerLabel}, {currency}{price}"`.
- `onTooltipUnselect`: `"Seat {number} cleared"`.
- `_jumpToSeat`: `"Moved to seat {number}"`.
- Попытка активировать disabled-кнопку Select: `"Cannot select seat {number}: {reason}"`.

Все строки локализованы — добавить ключи в `LOCALES_MAP` для всех языков. Politeness — `polite` (не assertive).

**Не вещает** общую сумму — это host-ответственность (host получает `seatSelected: IPassenger[]` и сам объявляет, если ему надо).

### Alternative list view

Новый standalone компонент `JetsSeatListComponent` (`projects/seatmap-lib/src/lib/components/jets-seat-list/`). Семантическая таблица:

```html
<table>
  <caption class="cdk-visually-hidden">{{ locale.allSeats }} — {{ cabinTitle }}</caption>
  <thead>
    <tr>
      <th scope="col">{{ locale.row }}</th>
      <th scope="col">{{ locale.seat }}</th>
      <th scope="col">{{ locale.cabin }}</th>
      <th scope="col">{{ locale.position }}</th>
      <th scope="col">{{ locale.features }}</th>
      <th scope="col">{{ locale.price }}</th>
      <th scope="col">{{ locale.status }}</th>
      <th scope="col">{{ locale.action }}</th>
    </tr>
  </thead>
  <tbody>…</tbody>
</table>
```

Фильтры (`<fieldset>` с `role="group"` и `aria-labelledby`): window-only, aisle-only, extra legroom, exit row, sort by price asc/desc.

Эмитит **те же** outputs (`seatSelected`/`seatUnselected`), что и grid. Использует тот же `seatmapService` для select/unselect → состояние синхронизировано.

Активация:
- Новый `@Input config.alternativeView?: 'grid' | 'list' | 'auto'`, default `'grid'` (backwards-compat).
- `'auto'` — `matchMedia('(max-width: 480px)')`, переключение реактивное.
- Toggle-кнопка в шапке (`<button>View as list / View as map</button>`, если режим не зафорсирован).
- Мотивация для ACR — закрывает **2.5.8 (target size)** и даёт «не-визуальную модель» как best-practice, не 1.4.10.

### Accessible-name builder

Чистая функция `utils/a11y.ts`:

```ts
export function buildSeatAriaLabel(
  seat: ISeatData,
  position: 'window' | 'aisle' | 'middle' | null,
  locale: Record<string, string>,
): string;
```

Формирует:
- Доступное: `"14C, aisle, extra legroom, available, €12"`.
- Выбранное: `"14C, window, selected for John Doe"`.
- Недоступное: `"14B, middle, unavailable"`.
- Ограничение: `"12A, window, exit row, not available for infant"`.

Position рассчитывается по индексу в `row.seats` (первая/последняя seat в ряду = window; примыкающая к aisle-cell = aisle; остальные = middle).

### SVG доступность и forced-colors

- Декоративные SVG (`jets-plane-body`, `jets-wing`, `jets-deck-separator`, fuselage внутри plane-body, nose, tail) — `aria-hidden="true"` на корне.
- Tooltip amenity-иконки (`getAmenityIcon`, `getDimIcon`) — `aria-hidden="true"` на `<span>`-обёртке (текст amenity уже visible).
- Inner SVG в seat-кнопке (через `bypassSecurityTrustHtml`) — `aria-hidden="true"` через wrapper `.jets-seat__svg`. Aria-label на кнопке — единый источник истины.
- Passenger-badge (`.jets-seat__passenger`), price-pill (`.jets-seat__price`) — декоративные дубликаты для AT, `aria-hidden="true"` (текст уже в aria-label).
- Cross для unavailable — `aria-hidden="true"` (текст «unavailable» уже в aria-label).
- **Forced-colors**: текущие SVG имеют hardcoded `fill="…"`/`stroke="…"` через template strings. Это блокирует Windows High Contrast. Замена hardcoded fill → CSS variables / `currentColor` для одноцветных иконок; добавление `@media (forced-colors: active) { svg path { fill: CanvasText; stroke: CanvasText; } }`. Аудит охватывает: `seat-template.service.ts`, `SEAT_FEATURES_ICONS`, `SEAT_MEASUREMENTS_ICONS`, `nose-template.service.ts`, `jets-tail`, `jets-deck-exit`, `jets-bulk`, `jets-deck-selector` SVG.

### prefers-reduced-motion

- `_jumpToSeat` — `scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })`.
- Hover `filter: brightness(1.08)` в `jets-seat.component.scss:166` — обернуть в `@media (prefers-reduced-motion: no-preference)`.
- Deck-selector rotate (`rotate(${180 * activeIndex}deg)`) — обернуть в media query, иначе `transition: none`.

### Deck selector

- `N = 2` декa (текущий типичный случай): `<button role="switch" aria-checked="{isUpperActive}" aria-label="Switch to {nextDeckTitle}">`.
- `N ≥ 3`: переделать в `role="tablist"` + N `role="tab"` + `aria-controls` + arrow-key navigation. Это отдельная под-задача внутри коммита 9.
- После переключения деки фокус — на первое interactable место новой деки (через LiveAnnouncer + roving update).

### Зависимости

Добавить `@angular/cdk` в `peerDependencies` библиотеки (`projects/seatmap-lib/package.json`) и в `devDependencies` корня (для разработки/демо). Версия `^21.2.0` (синхронно с Angular). Используется только `LiveAnnouncer` из `@angular/cdk/a11y` — bundle-cost ~30кб, но даёт стандартную, отлаженную имплементацию live-region (важно для ACR). Альтернатива (собственная мини-реализация) — отвергнута ради надёжности.

В CHANGELOG отметить: новая обязательная peer dependency — minor bump семвер (или major, если строго следовать).

### Default color contrast — breaking change

`DEFAULT_COLOR_THEME` (constants.ts:120-185) обновится: новые токены, удовлетворяющие 4.5:1 для текста на залитом seat-фоне и 3:1 для UI-границ. Старые consumers, не переопределявшие тему, увидят слегка другие цвета. Это **breaking change** в визуале → отметить в CHANGELOG и в README. Host'ы, передающие свой `colorTheme`, не затрагиваются.

### Документация

- `projects/seatmap-lib/README.md` — новая секция «Accessibility»: что закрыто внутри библиотеки, что — ответственность host'а (page title, lang, аутентификация, ACR на странице).
- `docs/ACR.md` — таблица «WCAG 2.2 SC → как закрыт → ссылка на файл/строки». Все 50 SC уровней A+AA + 9 новых WCAG 2.2.
- Override-документация: при переопределении `JetsSeat`/`JetsTooltip`/`JetsTooltipView` через `componentOverrides`, host обязан сохранить ARIA-семантику — пример в README.

---

## План коммитов (упорядоченный)

| # | Commit | Тип | Содержание | Breaking? |
|---|---|---|---|---|
| 1 | `chore(a11y): add @angular/cdk@^21.2.0 peer dep` | chore | `package.json` + lib `peerDependencies` + `package-lock.json`. | Yes (peer) |
| 2 | `feat(a11y): hide decorative graphics from AT` | feat | `aria-hidden="true"` на: jets-plane-body, jets-wing, jets-deck-separator, jets-nose, jets-tail, jets-deck-exit SVG, jets-bulk SVG, jets-deck-selector SVG, tooltip amenity/dimension иконки, jets-seat .jets-seat__svg / .jets-seat__cross / .jets-seat__passenger / .jets-seat__price. | No |
| 3 | `feat(a11y): accessible-name builder + locale keys` | feat | `utils/a11y.ts` (buildSeatAriaLabel, computeSeatPosition); расширить `LOCALES_MAP` всеми языками (EN/RU/CN/DE/FR/ES/IT/PT/PT-BR/AR/JA/KO/TR/NL/PL/CS/UK/VI) — ключи: `seatPositionWindow`, `seatPositionAisle`, `seatPositionMiddle`, `seatExtraLegroom`, `seatExitRow`, `seatAvailable`, `seatUnavailable`, `seatSelected`, `seatSelectedFor`, `seatRestrictedFor`, `close`, `moveToSeat`, `gridLabel`, plus список/таблица. | No |
| 4 | `feat(a11y): default color tokens meet WCAG AA contrast` | feat | Обновить `DEFAULT_COLOR_THEME` в `constants.ts`. Заменить `opacity: 0.6` на дискретный токен. Зафиксировать контрасты в комментарии (4.5:1 / 3:1). Демо-снапшоты в `colorTheme` e2e-тестах перегенерировать. | **Visual breaking** |
| 5 | `feat(a11y): seat is a button with ARIA semantics` | feat | `JetsSeatComponent`: корень `<div>` → `<button type="button" role="gridcell">`. Новые `@Input`: `ariaLabel`, `ariaSelected`, `ariaDisabled`, `rovingTabindex`, `colIndex`. **Не использовать `disabled`** — только `aria-disabled`. Сохранить класс `.jets-seat` и `data-seat-number`. Click handler — игнорировать активацию если `aria-disabled`. Добавить `:focus-visible` SCSS. Pass-through inputs для seat-override. | No (DOM-структура изменилась, но selector `.jets-seat` сохранён; consumers, опиравшиеся на тег `div.jets-seat`, затронуты — упомянуть в CHANGELOG) |
| 6 | `feat(a11y): grid scaffolding (role=grid/row/gridcell)` | feat | `JetsSeatMapComponent`: обёртка `<section role="region" [attr.aria-labelledby]>` + h2 cdk-visually-hidden + skip-link. На каждой палубе `role="grid"` с `aria-label`/`aria-rowcount`/`aria-colcount`. `JetsRowComponent`: `role="row"` + `aria-rowindex`. `JetsSeatComponent`: `aria-colindex` от родителя. Aisle/empty — `role="gridcell" aria-label="aisle/empty"`. | No |
| 7 | `feat(a11y): roving tabindex + 2D keyboard navigation` | feat | Новый `SeatGridNavigationService` (или класс-логика в JetsSeatMapComponent). Состояние `focusedCell`. Keydown на grid: Arrow/Home/End/Ctrl+Home/Ctrl+End/PageUp/PageDown, Ctrl+Arrow (skim). Enter/Space → existing `onSeatClick`. Esc → close tooltip. После клавиатурного фокуса в новую палубу — синхронизация `activeDeckIndex`. | No |
| 8 | `fix(a11y): 1.4.13 hover-tooltip focus-aware + dismissable` | fix | `onSeatFocusIn` открывает тултип (parity с mouseenter, если `tooltipOnHover`). `onSeatMouseLeave` — задержка перед закрытием с проверкой `relatedTarget` (если курсор уходит в тултип — не закрывать). `keydown.escape` на корне seat-map / tooltip → закрытие. | No |
| 9 | `feat(a11y): LiveAnnouncer for selection/jump/restrictions` | feat | Inject LiveAnnouncer в JetsSeatMapComponent. Вещать на: select, unselect, jump-to-seat, попытку выбрать restricted seat. Все строки через локали. Visually-hidden fallback-region (`aria-live="polite"`) если cdk недоступен — на случай tree-shaking. | No |
| 10 | `feat(a11y): expose seat-restriction reasoning (3.3.1/3.3.3)` | feat | В тултипе под disabled-кнопкой Select — visible text с причиной (из локалей). `aria-describedby` на disabled-кнопку. При первом render тултипа с disabled-Select — LiveAnnouncer объявляет причину. Расширить `isSelectDisabled()` чтобы возвращал не bool, а enum/строку причины. | No |
| 11 | `feat(a11y): tooltip is a non-modal dialog` | feat | `role="dialog"` (без aria-modal), `aria-labelledby`, `aria-describedby`. Авто-фокус на primary action. `keydown.escape` → close. Восстановление фокуса на trigger seat (хранить `lastTriggerElement` в JetsSeatMapComponent). Для `sidePanel`-варианта — `role="region"`, без auto-focus. Локализованный aria-label для close-кнопки. | No |
| 12 | `feat(a11y): landmarks + skip link + deck-selector semantics` | feat | Часть «landmarks/skip link» уже в коммите 6 — добавить здесь deck-selector: при N=2 — `role="switch" aria-checked`; при N≥3 — `role="tablist"`/`role="tab"`/`aria-controls`. Arrow-keys на tablist. После переключения деки — focus на первое interactable место. | No |
| 13 | `feat(a11y): alternative list view + config.alternativeView` | feat | Новый `JetsSeatListComponent` + `.scss` + `.spec.ts`. Семантическая таблица + фильтры. Wired through JetsSeatMapComponent с тем же seatmapService. `config.alternativeView: 'grid' \| 'list' \| 'auto'` (default `'grid'`). matchMedia(480px) для `auto`. Toggle-кнопка. Экспорт компонента в `public-api.ts`. | No (default `grid` preserves behaviour) |
| 14 | `feat(a11y): prefers-reduced-motion` | feat | `_jumpToSeat` smooth → auto при reduce. `@media (prefers-reduced-motion: no-preference)` оборачивает hover `filter` и deck-selector rotation. | No |
| 15 | `feat(a11y): forced-colors / Windows High Contrast support` | feat | Аудит inline SVG: hardcoded `fill`/`stroke` → CSS-переменные или `currentColor`. `@media (forced-colors: active)` правила: outline для focus, CanvasText для иконок, ButtonFace для фонов. Тестировать в Edge с включённым high-contrast. | No |
| 16 | `test(a11y): jest-axe unit + @axe-core/playwright e2e` | test | `jest-axe` в `projects/seatmap-lib/src/lib/components/**/*.a11y.spec.ts` для seat-map, seat, tooltip, seat-list. `@axe-core/playwright` в новых e2e-сценариях `projects/seatmap-demo/e2e/a11y/*.spec.ts`: default, tooltipOnHover, multi-deck, sidePanel, RTL, alternative-list. Keyboard tests: Tab-into-grid, arrow navigation, Esc closes tooltip, focus-restoration, disabled-seat-is-focusable-but-Enter-noop, skim-mode. CI: fail on новых нарушениях. | No |
| 17 | `docs(a11y): README + ACR + override responsibility` | docs | README — секция «Accessibility»: что закрыто, что host. `docs/ACR.md` — полная WCAG 2.2 A+AA матрица. Override-документация: ответственность host при override `JetsSeat`/`JetsTooltip`/`JetsTooltipView`. | No |

**Помечены breaking changes:**
- Коммит 1 — добавление peer dependency `@angular/cdk`.
- Коммит 4 — изменение default цветов (визуальный breaking для consumers, не переопределяющих `colorTheme`).
- Коммит 5 — DOM-тег seat `div` → `button` (CSS-classes сохранены, но if consumer ссылался на `div.jets-seat` — затронут).

Все три согласовать с пользователем перед мержем; если категорически нельзя — обсудить откат (например, добавить `config.legacySeatMarkup` для совместимости).

---

## Критические файлы для модификации

- `projects/seatmap-lib/src/lib/components/jets-seat/jets-seat.component.ts` — корень → button, ARIA-input'ы, focus-стили.
- `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.ts` — focus-state, keyboard handler, LiveAnnouncer, лендмарки.
- `projects/seatmap-lib/src/lib/components/jets-seat-map/jets-seat-map.component.html` — region/grid wrapper, skip-link, conditional list view.
- `projects/seatmap-lib/src/lib/components/jets-row/jets-row.component.ts` — role="row", aria-rowindex, передача rovingTabindex.
- `projects/seatmap-lib/src/lib/components/jets-deck/jets-deck.component.ts` — role="grid" (на палубу), aria-rowcount/colcount.
- `projects/seatmap-lib/src/lib/components/jets-tooltip/jets-tooltip.component.ts` — role=dialog, focus-management, Esc, локализация close-label, описание ограничений.
- `projects/seatmap-lib/src/lib/components/jets-deck-selector/jets-deck-selector.component.ts` — switch/tablist semantics.
- `projects/seatmap-lib/src/lib/components/jets-plane-body/jets-plane-body.component.ts`, `jets-wing.component.ts`, `jets-deck-separator.component.ts`, `jets-nose.component.ts`, `jets-tail.component.ts`, `jets-bulk.component.ts`, `jets-deck-exit.component.ts` — `aria-hidden`, замена hardcoded SVG fill.
- `projects/seatmap-lib/src/lib/components/jets-seat-list/` — НОВЫЙ компонент (component.ts + .html + .scss + .spec.ts + .a11y.spec.ts).
- `projects/seatmap-lib/src/lib/services/seat-grid-navigation.service.ts` — НОВЫЙ сервис для roving + 2D nav.
- `projects/seatmap-lib/src/lib/utils/a11y.ts` — НОВЫЙ модуль buildSeatAriaLabel + computeSeatPosition.
- `projects/seatmap-lib/src/lib/constants.ts` — `LOCALES_MAP` пополнить, `DEFAULT_COLOR_THEME` пересчитать.
- `projects/seatmap-lib/src/lib/types.ts` — `IConfig.alternativeView`, `IConfig.seatRestrictionMessage` (опциональная фабрика сообщения).
- `projects/seatmap-lib/src/public-api.ts` — экспорт JetsSeatListComponent.
- `projects/seatmap-lib/package.json` — peer dep cdk.
- `projects/seatmap-lib/README.md`, `docs/ACR.md` — документация.
- `projects/seatmap-demo/e2e/a11y/` — НОВЫЕ Playwright тесты.

---

## Существующее, что переиспользуем

- `LOCALES_MAP` (constants.ts) — паттерн расширения для новых ARIA-строк.
- `seatmapService.selectSeatHandler` / `unselectSeatHandler` (jets-seat-map.service) — для list view, ничего не дублируем.
- `seatmapService.calculateTooltipData` — для list view не нужно, но для grid сохраняется.
- `data-seat-number` attribute — переиспользуем для focus-management.
- `_jumpToSeat` flow (jets-seat-map.component.ts:494) — расширяется для клавиатуры и LiveAnnouncer.
- `componentOverrides` инфраструктура — для override-компонентов добавляется только документация ответственности.
- `isSelectDisabled()` в tooltip — расширяется до возврата причины.
- Playwright e2e-инфраструктура (helpers/demo.ts) — переиспользуется для a11y-сценариев.

---

## Verification

После каждого коммита:

1. **Unit tests:** `cd projects/seatmap-lib && npx vitest run` — все существующие специи + новые a11y-специи проходят. Coverage не падает.
2. **E2E:** `cd projects/seatmap-demo && npx playwright test` — существующие тесты `colorTheme`, `seatEvents`, `currencySign`, `builtInTooltip`, `customSeatColorRanges`, `tooltipOnHover` проходят. Снимки `colorTheme/screenshots/*.png` могут потребовать `--update-snapshots` только после коммита 4 (default colors changed) и согласования визуала с пользователем.
3. **Lint/typecheck:** `npx ng lint && npx tsc --noEmit` — без новых предупреждений, без `any`.
4. **Build:** `npx ng build seatmap-lib` — публикуемая билда без ошибок.

После всей серии:

5. **Axe в CI:** `cd projects/seatmap-demo && npx playwright test e2e/a11y/` — все a11y-сценарии без violations. Demo crash on regression.
6. **Keyboard-only manual test:**
   - Чек-лист: Tab входит в карту → один tab-стоп. Arrow перемещает фокус. Home/End/Ctrl+Home/Ctrl+End работают. PageUp/Down — ±5 рядов. Ctrl+Arrow — skim по interactable. Enter открывает tooltip. Esc закрывает tooltip, фокус возвращается на seat. Tab внутри tooltip — циклит по кнопкам. Shift+Tab выводит из tooltip обратно в grid.
   - Toggle alternative view — фокус сохраняется логично.
   - Deck selector — switch (N=2) или tablist (N≥3), Arrow-keys работают.
7. **NVDA (Windows) + VoiceOver (macOS) manual:**
   - Каждое место произносит: `«Row 14, column 3, button, 14C, aisle, extra legroom, available, €12, not selected»`.
   - При select: `«Seat 14C selected for John Doe, €12»` через polite live-region.
   - Disabled-seat: `«14B, middle, unavailable, dim»` (NVDA aria-disabled).
   - Tooltip: `«Dialog, 14C, €12»`, далее описание.
   - List view: `«table, all seats, 180 rows, 8 columns»`; навигация по строкам/колонкам стандартными table-keys.
8. **High-contrast (Windows Edge / Firefox forced-colors):**
   - Все seat-границы видны.
   - Focus-ring контрастирует с CanvasText.
   - Иконки crosse/checkmark видны.
9. **prefers-reduced-motion (macOS Reduce Motion / DevTools):**
   - JumpToSeat — без smooth scroll.
   - Hover-эффект не появляется.
   - Deck-rotation мгновенный.
10. **200% zoom + 320px viewport:**
    - Auto-mode переключает на list view ниже 480px (документировать).
    - Контент не теряется.
11. **ACR draft review:** `docs/ACR.md` соответствует фактической имплементации; каждый «Supports» строка содержит ссылку на код/коммит.

---

## Progress tracking

Для каждого коммита: ставим `[x]` после мержа в `WCAG`, фиксируем SHA, дату и автора (имя сессии/агента или просто «Claude»). Дополнительные подробности — в «Decisions log» ниже.

| # | Коммит | Статус | SHA | Дата | Заметки |
|---|---|---|---|---|---|
| 0 | Копия плана в репо `docs/wcag/PLAN.md` | [x] | (этот коммит) | 2026-06-04 | план виден другим агентам/сессиям |
| 1 | `chore(a11y): add @angular/cdk@^21.2.0 peer dep` | [x] | `7d0b368` | 2026-06-04 | lib peerDep + root devDep; build OK |
| 2 | `feat(a11y): hide decorative graphics from AT` | [x] | `21c0eba` | 2026-06-04 | deck-selector отложен на commit 12 (его SVG = единственный visible-content интерактивной кнопки) |
| 3 | `feat(a11y): accessible-name builder + locale keys` | [x] | `7a70627` | 2026-06-04 | utils/a11y.ts + 18 locales × 22 keys; 317 unit tests green |
| 4 | `feat(a11y): default color tokens meet WCAG AA contrast` | [x] | `d49e100` | 2026-06-04 | sub-agent Wave B; user-approved snapshot regen, 99 PNG перегенерированы; visual breaking зафиксирован в CHANGELOG |
| 5 | `feat(a11y): seat is a button with ARIA semantics` | [x] | `df885db` | 2026-06-05 | sub-agent Wave C; DOM-breaking (`div.jets-seat` → `button.jets-seat`), user-approved; класс `.jets-seat` + `data-seat-number` сохранены, 15 регрессионных спецов |
| 6 | `feat(a11y): grid scaffolding (role=grid/row/gridcell)` | [x] | `49c34f6` | 2026-06-05 | sub-agent Wave D upstaled, orchestrator завершил; full Layout Grid pattern; jets-deck host=grid + aria-rowcount/colcount; jets-row host=row; jets-seat role=gridcell на обеих ветках + nonSeatAriaLabel + effectiveTabindex |
| 7 | `feat(a11y): roving tabindex + 2D keyboard navigation` | [x] | `c055e2a` (+ `61b3b78` сервис) | 2026-06-05 | split-then-wire: sub-agent написал pure SeatGridNavigationService + 66 спецов, orchestrator подключил в JetsSeatMapComponent (focusedCell state, onGridKeydown/Focusin, _applyRovingTabindex, _focusCell, onDeckSelect refinement); 452/452 тестов |
| 8 | `fix(a11y): 1.4.13 hover-tooltip focus-aware + dismissable` | [x] | `8ea5e36` | 2026-06-05 | sub-agent Wave F; focus-triggered tooltip + 80ms delayed close (hoverable) + Esc from inside tooltip + host-div для componentOverride |
| 9 | `feat(a11y): LiveAnnouncer for selection/jump/restrictions` | [x] | `d85a86a` | 2026-06-04 | sub-agent Wave B; polite announcements на select/unselect/jump; restriction-reason wiring оставлен TODO до интеграции commit 10's `selectAttemptBlocked` output |
| 10 | `feat(a11y): expose seat-restriction reasoning (3.3.1/3.3.3)` | [x] | `eb4d17f` | 2026-06-04 | sub-agent Wave B; `getSelectDisabledReason()` + visible text + `aria-describedby` + `selectAttemptBlocked` Output; `isSelectDisabled()` boolean-facade сохранён |
| 11 | `feat(a11y): tooltip is a non-modal dialog` | [x] | `8ce3f3f` | 2026-06-05 | sub-agent Wave F; role=dialog (no aria-modal/no trap) + auto-focus primary + Esc + lastTriggerElement focus restoration + sidePanel = role=region; close aria-label локализован |
| 12 | `feat(a11y): landmarks + skip link + deck-selector semantics` | [x] | `f216a55` | 2026-06-05 | sub-agent Wave C; `<section role="region">` + visually-hidden h2 + skip-link; deck-selector → switch (N=2) / tablist (N≥3) с arrow-навигацией; focus на первое interactive место после смены палубы |
| 13 | `feat(a11y): alternative list view + config.alternativeView` | [x] | `b81fead` | 2026-06-05 | sub-agent Wave D upstaled на финале, orchestrator дописал matchMedia watcher / effectiveView / toggle / spec; новый JetsSeatListComponent + filters + sort; default `alternativeView='grid'` |
| 14 | `feat(a11y): prefers-reduced-motion` | [x] | `8fbc5a3` | 2026-06-04 | sub-agent Wave A; scrollIntoView SSR-safe, hover wrapped в `prefers-reduced-motion: no-preference` |
| 15 | `feat(a11y): forced-colors / Windows High Contrast support` | [x] | `22494ce` | 2026-06-04 | sub-agent Wave A; forced-colors SCSS на seat/exit/deck-selector/deck-separator; декоративный chrome оставлен браузеру |
| 16 | `test(a11y): jest-axe unit + @axe-core/playwright e2e` | [x] | `9a9ab70` | 2026-06-05 | sub-agent Wave G; 4 jest-axe unit-сценария (default, tooltip open, list view, 3-deck tablist) + 3 Playwright e2e (axe + tab cycle + arrow + dialog); color-contrast в jsdom отключён (false-positives без layout); npm scripts `test:a11y` / `e2e:a11y` |
| 17 | `docs(a11y): README + ACR + override responsibility` | [x] | `5d3a35a` | 2026-06-05 | sub-agent Wave G; README получил секцию Accessibility + override-responsibility snippet; docs/ACR.md — 59 SC (33 Supports, 18 N/A, 6 Host responsibility, 2 Partially); CHANGELOG.md с тремя breaking changes (peer dep, default colors, DOM tag) |

### Phase 2 — opt-in flags + port на свежий `main` (branch `wcag-port-main`)

| # | Коммит | Статус | SHA | Дата | Заметки |
|---|---|---|---|---|---|
| P2.0 | `Merge branch 'main' into wcag-port-main` | [x] | `8ae065a` | 2026-06-16 | подтянут свежий `main` со всеми React-parity фиксами поверх Phase 1 tip `30038c8` |
| P2.1 | `fix(seatmap-lib): skip tooltip focus-return in tooltipOnHover mode` | [x] | `dfb43d7` | 2026-06-16 | hover-режим не должен возвращать фокус на trigger |
| P2.2 | `feat(seatmap-lib): add IWcagConfig + per-feature WCAG flags (default off)` | [x] | `75c961e` | 2026-06-16 | `IWcagConfig` в types.ts; `getWcagFlags`/`Required<IWcagConfig>` резолвер; `keyboardNavigation` требует `gridSemantics` |
| P2.3 | `chore(e2e): regenerate demo screenshots after Phase 2 flag refactor` | [x] | `9ecde11` | 2026-06-16 | baseline-скриншоты демо после рефактора флагов |
| P2.4 | `fix(seatmap-lib): defer WCAG palette via wcagPalette plumbing; restore main parity` | [x] | `868df0a` | 2026-06-16 | AA-палитра → `WCAG_COLOR_THEME`, подмешивается только при `defaultColorTheme`; дефолт = `LEGACY_COLOR_THEME` |
| P2.5 | `test(seatmap-demo): add WCAG snapshot-comparison harness` | [x] | `2edf176` | 2026-06-16 | `e2e/comparison/`, `$WCAG_PRESET` = off/mid/on; **сравнение прогнано, пресет `off` = нулевой diff с `main`** |

После каждого коммита:
```
# В директории jets-seatmap-angular-lib
git add <files>
git commit -m "..."
git fetch origin WCAG
git rebase origin/WCAG
# обновить progress в docs/wcag/PLAN.md, закоммитить как отдельный коммит "docs(wcag): mark commit N done"
git push origin HEAD:WCAG
```

Никаких `--force` / `--force-with-lease` к `WCAG`. Если push отвергнут — снова fetch+rebase+push (см. `feedback_push_demo.md`-протокол, тот же).

---

## Decisions log

Решения, принятые в ходе планирования и имплементации. Не пересматривать без явного отката.

- **2026-06-04 — ARIA grid pattern:** выбран полный Layout Grid pattern по APG; **все** позиции (включая `aisle`, `empty`, `unavailable`) — `role="gridcell"` с tabindex и aria-label. Sparse roving («фокус только по interactable») отвергнут как противоречащий APG. Skim-mode по `Ctrl+Arrow` / `PageUp`-`Down` для UX. (Решение по совету Plan-агента.)
- **2026-06-04 — Tooltip role:** `role="dialog"` **без** `aria-modal`, **без** `cdkTrapFocus`. Карта не оверлится, клик снаружи закрывает (`onMapClick`) — modal-контракт нарушился бы. Восстановление фокуса на trigger seat при закрытии. `sidePanel`-вариант — `role="region"`, не dialog.
- **2026-06-04 — Unavailable seats:** `<button>` **без** `disabled`-атрибута (он убирает focusability), с `aria-disabled="true"`. Обработчик активации игнорирует клик/Enter, если aria-disabled.
- **2026-06-04 — CDK dependency:** подключаем `@angular/cdk@^21.2.0` как peer dep ради `LiveAnnouncer`. Bundle-cost ~30кб принят ради надёжной отлаженной имплементации. Собственная мини-реализация live-region отвергнута.
- **2026-06-04 — Reflow vs target-size:** list view мотивируется через **2.5.8 (target size)**, а не через 1.4.10 (карта попадает под исключение «2D layout required for meaning»). В ACR это разные строки.
- **2026-06-04 — Default colors:** обновление `DEFAULT_COLOR_THEME` — **visual breaking change**. Перед мержем коммита 4 согласовать с пользователем перегенерацию snapshot-ов `colorTheme/screenshots/*.png`.
- **2026-06-04 — DOM tag change:** seat `div` → `button` — DOM-breaking для consumers, опиравшихся на `div.jets-seat`. CSS-класс `.jets-seat` и `data-seat-number` атрибут сохраняются. Отмечено в CHANGELOG коммита 5.
- **2026-06-04 — Orchestration mode:** пользователь явно попросил оркестрационную модель работы. Claude как orchestrator анализирует DAG зависимостей, готовит worktree'ы, диспатчит параллельные суб-агенты (`Agent` tool, `general-purpose`), сам делает PLAN.md updates после волны. Суб-агенты PLAN.md **не трогают** — иначе merge-конфликты на одной строке. Подробности в Claude memory `project_wcag_orchestration`.
- **2026-06-04 — Commit 4 approval:** пользователь явно дал «ок» на default-colors visual breaking change и регенерацию `colorTheme/screenshots/*.png` через `playwright test --update-snapshots`. Можно дисpatch'ить суб-агенту.
- **2026-06-16 — Phase 2, opt-in flags (отмена breaking-by-default):** Phase 1 включала все a11y-фичи по умолчанию, что давало visual/DOM-breaking для существующих consumers. Решено: спрятать всё за `config.wcag: IWcagConfig`, все флаги default `false`. Без opt-in рендер байт-в-байт совпадает с `main`. Это снимает три breaking changes из CHANGELOG Phase 1 (теперь они проявляются только при явном включении флагов). Реализовано в ветке `wcag-port-main` поверх свежего `main`.
- **2026-06-16 — AA-палитра как отдельный токен-сет:** вместо переписывания `DEFAULT_COLOR_THEME` (Phase 1) AA-контрастные цвета вынесены в `WCAG_COLOR_THEME` и подмешиваются базой под `config.colorTheme` только при `defaultColorTheme === true`. Историческая палитра переименована/сохранена как `LEGACY_COLOR_THEME` и остаётся дефолтом. Commit `868df0a`.
- **2026-06-16 — Snapshot-parity как gate:** добавлен harness `projects/seatmap-demo/e2e/comparison/` (commit `2edf176`) с env `$WCAG_PRESET` (`off`/`mid`/`on`), прогоняемый дважды (против `origin/main` и против ветки) в разные `$OUT_DIR`. Критерий приёмки: пресет `off` = нулевой diff с `main`. **Прогнано и пройдено 2026-06-16** — повторять не требуется.
- **2026-06-18 — «Skip to seat selection» link (вход в грид за один Tab):** дефолтный skip-link уводил только МИМО карты; добраться до самих кресел с клавиатуры было неочевидно (особенно за deck-selector/skip-link перед гридом). Добавлена комплементарная skip-ссылка (под `landmarksAndSkipLink && gridSemantics`), которая фокусирует roving-якорь (`[role=gridcell][tabindex="0"]`, fallback — первый focusable gridcell). Геттер `jumpToSeatsLabel` (локаль `skipToSeats`, EN-fallback), хендлер `onJumpToSeatsClick`. Проверено в браузере. Сама механика Tab→грид→стрелки и до этого работала — это эргономическое улучшение discoverability.
- **2026-06-18 — Tooltip-dialog «владеет» клавиатурой пока открыт:** тултип рендерится внутри `#mapContainer` (на нём `(keydown)=onGridKeydown`), поэтому стрелки с кнопок Select/Cancel всплывали в грид и `_focusCell` выдёргивал фокус обратно на кресло. Фикс: (1) `onGridKeydown` не выполняет grid-навигацию, пока открыт активационный диалог (`tooltipDialog && activeTooltip && !tooltipOnHover`); (2) тултип авто-фокусирует primary-кнопку, а при её отсутствии — кнопку × (фокус всегда внутри диалога); (3) `onDialogKeydown` гоняет фокус между кнопками по стрелкам + `stopPropagation`. Возврат фокуса на кресло при закрытии уже был (`_restoreFocusToTrigger`). Подтверждено в браузере (Playwright) на задеплоенной версии. 564/564 unit.
- **2026-06-18 — Seat-only arrow navigation (отход от строгого APG Layout Grid):** изначально (commit 7) грид следовал строгому APG — каждая позиция, включая спейсеры `aisle`/`empty`/`index`, была focus-target стрелок, со skim по `Ctrl+Arrow`. На практике это давало focus-ring вокруг пустого места между креслами (см. баг-репорт пользователя) и шумную навигацию. Решение по выбору пользователя: **обычные стрелки ходят только по реальным креслам** (`type === 'seat'`, любой статус, включая `unavailable`), пропуская спейсеры и seatless-ряды-разделители; `Ctrl+Arrow` skim по-прежнему фильтрует до interactable (исключая `unavailable`). Спейсеры сохраняют `role="gridcell"` + `aria-label` (структура грида для SR) и `tabindex="-1"`, но больше не фокусируются стрелками. Реализация — `SeatGridNavigationService` (seat-aware `stepHorizontal`/`stepVertical`/`firstSeatCol`/`lastSeatCol`/`nearestSeatCol`); 558/558 unit зелёные. ACR-формулировку по APG Layout Grid поправить под этот отход.

---

## Open questions / blockers

Активные вопросы, которые ждут решения от пользователя или внешних обстоятельств. Закрытые вопросы перенести в Decisions log.

- (нет открытых)

---

## Active claims

Кто сейчас работает над каким коммитом, чтобы не дублировать. Снимать запись после мержа коммита в `origin/WCAG`. Перед стартом нового коммита — `git pull` и проверить эту таблицу.

| Коммит | Worktree / сессия | Claimed at |
|---|---|---|
| — | (никто) | — |

---

## Известные границы ответственности (вне библиотеки)

Эти WCAG-критерии — ответственность host-страницы, библиотека их не решает и в ACR помечает «Host responsibility»:
- 1.4.2 Audio Control — нет аудио.
- 2.4.2 Page Titled — host.
- 3.1.1 Language of Page — host (`<html lang>`).
- 3.1.2 Language of Parts — host, если страница многоязычная.
- 1.3.5 Identify Input Purpose — нет input'ов в библиотеке.
- 2.5.5 Target Size (Enhanced) — AAA, вне scope AA.
- Аутентификация / оплата (3.3.7 Redundant Entry, 3.3.8 Accessible Authentication) — host.

Документировать в README + ACR.
