# CapitalView web — consignes pour les sessions de développement

## Où sont les règles

Le front n'invente aucune règle de tri, de solde ou de récurrent : elles vivent dans l'API, et le front les affiche.

| Avant de toucher | Lire dans `capitalview-api` |
| --- | --- |
| `src/pages/Bank*.vue`, `src/components/bank/`, `src/composables/useBank*.ts`, `src/utils/cashflowTypes.ts`, `src/utils/bankHistory.ts`, `src/utils/optimisticAnswers.ts` | `docs/bank-sorting.md` : règles R1 à R53, et la table « Textes d'interface » qui fixe les libellés affichés |
| `src/components/bank/BankEntryModal.vue`, `src/components/imports/PlatformImportModal.vue` (partie banque) | `docs/bank-ledger.md` : règles L1 à L9 |

Un texte d'interface qui change se change aussi dans la table de `docs/bank-sorting.md`, et un comportement nouveau
s'ajoute à son journal daté, côté API.

## Conventions

- Vue 3, TypeScript, Tailwind v4 ; interface en français, euro comme pivot ; thèmes clair et sombre tous deux
  obligatoires (voir `PRODUCT.md`).
- Commits : `type(scope): sujet` à l'impératif, en anglais, en minuscules.
- Vérifications : `pnpm run type-check`, `pnpm run test`, `pnpm run build`.
