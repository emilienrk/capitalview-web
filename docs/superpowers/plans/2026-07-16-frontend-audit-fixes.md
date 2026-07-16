# Frontend Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les problèmes de l'audit frontend : fuite de données au logout, duplication massive, bugs de logique, UX (alert/confirm natifs, a11y), et rendre le site plus asynchrone (impression de rapidité).

**Architecture:** Extraction de composables partagés (`useHistoryGranularity`, `useCarousel`, `useStatsPager`, `useConfirm`), service de reset de session, chargements parallélisés et rafraîchissements ciblés (invalidation de cache au lieu de rechargement complet), remplacement des popups natives par le design system.

**Tech Stack:** Vue 3 (composition), Pinia, Tailwind v4, ECharts, Vitest (à ajouter), pnpm.

## Global Constraints

- `node` absent du PATH : préfixer `export PATH="/nix/store/4366l8b6kz1f2sxq6243rfs53grc73zz-nodejs-slim-24.15.0/bin:$PATH"` (retrouver via `head -1 $(which pnpm)`).
- Vérification après chaque tâche : `pnpm type-check` (doit rester vert).
- Textes UI en français avec accents corrects.
- Commit après chaque tâche (repo git = `capitalview-web`, branche `main`).
- Hors périmètre (backend) : déduction bancaire atomique côté serveur (`/crypto` + `/stocks` deposit avec `bank_account_id`) — à traiter dans `capitalview-api`. Le front garde le comportement actuel en attendant.

---

### Task 1: Reset de session (logout/login) — caches + stores

**Files:**
- Create: `src/services/sessionReset.ts`
- Modify: `src/stores/auth.ts` (clearSession → reset global), stores sans `reset()` : `src/stores/bank.ts`, `src/stores/stocks.ts`, `src/stores/cashflow.ts`, `src/stores/notes.ts`, `src/stores/community.ts`, `src/stores/settings.ts`, `src/stores/asset.ts`, `src/stores/imports.ts`

**Interfaces:**
- Produces: `resetAllSessionState(): void` — appelle `clearCache()` (services/cache) puis `reset()` de chaque store de données. Appelé dans `auth.clearSession()` (couvre logout + session expirée) et au début de `_finishSession()` (session fraîche au login).

**Steps:**
- [ ] Ajouter `reset()` aux stores qui n'en ont pas (remise à zéro des refs de données + error).
- [ ] Créer `sessionReset.ts` (imports des stores à l'intérieur de la fonction pour éviter les cycles).
- [ ] Brancher dans `auth.ts`.
- [ ] `pnpm type-check` → PASS. Commit `fix: clear caches and stores on logout/login (data leak between sessions)`.

### Task 2: Vitest + composable `useHistoryGranularity`

**Files:**
- Modify: `package.json` (devDep vitest, script `test`), `pnpm-workspace.yaml` si besoin
- Create: `src/composables/useHistoryGranularity.ts`, `src/composables/__tests__/useHistoryGranularity.spec.ts`
- Modify: `src/pages/Crypto.vue`, `src/pages/Stock.vue`, `src/pages/Dashboard.vue`, `src/pages/Bank.vue` (suppression des copies locales)

**Interfaces:**
- Produces:
  - `type HistoryGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'`
  - Fonctions pures exportées : `getIsoWeekKey(date: string): string`, `getHistoryBucketKey(date: string, g: HistoryGranularity): string`, `bucketHistoryByGranularity<T extends { snapshot_date: string }>(history: T[], g: HistoryGranularity): T[]`, `getHistorySpanDays(history: { snapshot_date: string }[]): number`
  - `useHistoryGranularity(historySource: () => { snapshot_date: string }[])` → `{ granularity: Ref<HistoryGranularity>, granularityOptions: ComputedRef<{value,label}[]>, applyGranularity<T>(h: T[]): T[] }` (watch de clamp intégré ; seuil yearly unifié à 365 jours).
- [ ] `pnpm add -D vitest` ; script `"test": "vitest run"`.
- [ ] Tests d'abord (bucket weekly/monthly/yearly, span, tri non garanti → tri interne), puis implémentation. `bucketHistoryByGranularity` trie par date avant bucketisation (corrige le bug de tri non garanti).
- [ ] Migrer les 4 pages. `pnpm test` + `pnpm type-check` → PASS. Commit.

### Task 3: Composables `useCarousel` et `useStatsPager`

**Files:**
- Create: `src/composables/useCarousel.ts`, `src/composables/useStatsPager.ts`
- Modify: `src/pages/Crypto.vue`, `src/pages/Stock.vue`, `src/pages/Dashboard.vue`

**Interfaces:**
- `useCarousel<K extends string>(slides: Array<{ key: K; label: string }>)` → `{ current: Ref<K>, currentLabel: ComputedRef<string>, next(): void, prev(): void, swipeHandlers: { onTouchStart, onTouchEnd } }` (seuils 60px/60px comme l'existant).
- `useStatsPager(stats: ComputedRef<SummaryStatItem[]>, perPage = 4)` → `{ page: Ref<number>, pages: ComputedRef<SummaryStatItem[][]>, activeStats: ComputedRef<SummaryStatItem[]>, resetPage(): void }` avec type exporté `SummaryStatItem`.
- [ ] Migrer les 3 pages (Dashboard : breakdown + projection slides). Type-check. Commit.

### Task 4: `useConfirm` + suppression des `alert()`/`confirm()` natifs

**Files:**
- Create: `src/composables/useConfirm.ts`, `src/components/base/BaseConfirmDialog.vue`
- Modify: `src/App.vue` (monter le dialog global), `src/components/index.ts`
- Modify: `src/pages/Crypto.vue`, `src/pages/Stock.vue`, `src/pages/Bank.vue`, `src/pages/settings/SettingsAI.vue`, `src/components/imports/PlatformImportModal.vue`

**Interfaces:**
- `useConfirm()` → `{ confirmDialog(opts: { title: string; message: string; confirmLabel?: string; variant?: 'danger' | 'primary' }): Promise<boolean> }` (état global module-level, résolu par BaseConfirmDialog).
- Validations de formulaires : remplacer `alert(msg)` par un `formError = ref<string|null>()` affiché en `BaseAlert variant="danger"` en tête de modal (le modal reste ouvert).
- [ ] Grep final : plus aucun `window.alert`/`confirm(` natif. Type-check. Commit.

### Task 5: Accessibilité + robustesse `BaseModal`

**Files:**
- Modify: `src/components/base/BaseModal.vue`, `src/layouts/DefaultLayout.vue`
- Create: `src/services/scrollLock.ts`

**Interfaces:**
- `scrollLock.ts` : `lockScroll(): void`, `unlockScroll(): void` avec compteur (modals + sidebar partagent le lock sans se marcher dessus).
- BaseModal : `role="dialog"`, `aria-modal="true"`, `aria-labelledby` sur le titre, fermeture sur `Escape`, focus initial dans le panel, restauration du focus à la fermeture, `onUnmounted` → unlock, bouton × avec `aria-label="Fermer"`.
- [ ] Type-check. Commit.

### Task 6: Rafraîchissements ciblés + fix toggle `selectAccount` après import

**Files:**
- Modify: `src/pages/Crypto.vue`, `src/pages/Stock.vue`

**Interfaces:**
- `refreshAccountView(id: string): Promise<void>` (dans chaque page) : sélectionne SANS toggle et recharge compte + transactions. Les handlers d'import l'utilisent au lieu de `selectAccount`.
- Après mutation : invalider le cache historique puis recharger UNIQUEMENT l'historique global + celui du compte affecté (plus de rechargement force de tous les comptes). Rechargements de charts en arrière-plan (non bloquants pour l'UI positions/transactions).
- `handlePhotoImport` (Crypto) : utiliser l'endpoint bulk composite existant (`bulkCompositeImportTransactions`) au lieu de N requêtes séquentielles ; afficher un récapitulatif d'erreurs via `txWarning`.
- [ ] Type-check. Commit.

### Task 7: Montages parallélisés (impression de rapidité)

**Files:**
- Modify: `src/pages/Crypto.vue`, `src/pages/Stock.vue`, `src/pages/Bank.vue`, `src/pages/Cashflow.vue` (déjà parallèle — vérifier), `src/pages/Asset.vue`
- Modify: `src/stores/auth.ts` (`checkAuth` : await du `/auth/me` retiré du chemin critique mais erreurs loguées)

**Comportement:**
- Crypto : settings d'abord (conditionne le mode), puis comptes/compte défaut ; transactions + taux + historiques lancés en parallèle sans bloquer le premier rendu (les sections ont déjà leurs états de chargement).
- Stock : `fetchAccounts()` await (nécessaire à l'affichage), puis historiques + transactions + taux en parallèle non bloquants.
- [ ] Type-check. Commit.

### Task 8: Corrections UX/logique ponctuelles

**Files:**
- Modify: `src/pages/Login.vue` (afficher `outcome.message` réel), `src/router/index.ts` (guard `recover` si authentifié), `src/pages/Stock.vue` + `src/pages/Dashboard.vue` + `src/pages/Asset.vue` (accents : « Évolution », « Répartition », « projetée », « l'évolution des biens »), `src/stores/auth.ts` (messages en français), `src/pages/Cashflow.vue` (édition : préserver l'année de la date d'origine ; jours du mois valides selon le mois)
- [ ] Type-check. Commit.

### Task 9: Nettoyage + perf de chargement

**Files:**
- Delete: `src/stores/counter.ts`, `package-lock.json`
- Modify: `src/stores/auth.ts` (supprimer `loginForm`, `registerForm`, `isRegisterMode`, `submitForm`, `resetForms`, `refreshToken` morts), `src/style.css` + `index.html` (fonts : `preconnect` + `<link>` non bloquant au lieu de `@import` CSS ; Umami conditionné au build prod via `import.meta.env.PROD` dans `main.ts`)
- [ ] Type-check + `pnpm build-only` → PASS. Commit.

### Task 10: Fusion de la duplication de template Crypto (SINGLE/MULTI)

**Files:**
- Create: `src/components/crypto/CryptoChartsPanel.vue` (slides évolution/répartition/P&L partagés)
- Modify: `src/pages/Crypto.vue` (les deux blocs utilisent le composant)

**Interfaces:**
- Props : `{ slide, slides, chartSeries, allocationSegments, pnlSeries, cumulativePnlSeries, granularity, granularityOptions, isDark, loading }` + events `update:slide`, `update:granularity`, `update:performance`, `refresh`.
- À n'exécuter que si les blocs sont réellement isomorphes après lecture ; sinon documenter l'écart et extraire le maximum commun.
- [ ] Type-check + build. Commit.
