# Home Screen Widget Architecture

## Goal
Prepare a widget-ready architecture for PWA/mobile surfaces without coupling widgets to screen-specific DOM.

## Widget Targets
- Budget Widget
  - Current Budget
  - Spent
  - Remaining
- Savings Widget
  - Current Savings Balance
- Quick Add Widget
  - Add Expense
  - Add Savings Entry

## Architecture Layers
1. Data Snapshot Layer
- Create a normalized `widgetSnapshot` from existing storage helpers.
- Source APIs:
  - `getBudgets`
  - `getExpenses`
  - `getSavings`
  - `getActiveBudgetPeriod`
- Shape:
  - `generatedAt`
  - `budget.current`
  - `budget.spent`
  - `budget.remaining`
  - `savings.balance`
  - `quickActions`

2. Widget Service Layer
- Add `buildWidgetSnapshot()` in core script scope.
- Add `publishWidgetSnapshot()` to persist snapshot in localStorage key `widgetSnapshotV1`.
- Trigger snapshot publish on:
  - expense save
  - savings save
  - budget update
  - app load

3. UI Integration Layer
- Add future-safe deep links:
  - `index.html#add-expense`
  - `pages/savings.html#add-entry`
- Widget clients read `widgetSnapshotV1` and render compact cards.

4. Notification Bridge Layer
- Optional service-worker message channel to refresh widget clients when snapshot changes.
- Message type: `WIDGET_SNAPSHOT_UPDATED`.

## PWA / Mobile Readiness
- Keep snapshot payload small and numeric-first.
- Avoid direct business logic in widget rendering.
- Keep all formatting locale-aware in host app.
- Support stale snapshot fallback by showing `generatedAt` age.

## Implementation Plan
1. Add snapshot builder and publisher functions.
2. Wire publisher into existing transaction save flows.
3. Expose quick-action anchors for widget launch intents.
4. Add service-worker broadcast (optional phase 2).
5. Add QA checklist for widget data parity with dashboard cards.

## Validation Checklist
- Budget widget values match dashboard values.
- Savings widget value matches savings home total.
- Quick add intents open the correct forms.
- Snapshot updates after create/edit/delete transaction flows.
