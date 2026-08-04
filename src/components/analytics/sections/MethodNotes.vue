<script setup lang="ts">
/**
 * What holds for the whole page, and the indicators it deliberately does not
 * compute. A missing indicator has to be a visible choice, not an oversight.
 *
 * Everything that explains one block now sits behind that block's "?" instead —
 * it was never missing here, only far from what it explained, which is why the
 * blocks kept repeating it in their own bodies. What is left is what belongs to
 * no single block.
 */
import type { CounterfactualResponse } from '@/types'

defineProps<{ bridge: CounterfactualResponse | null }>()
</script>

<template>
  <details class="mt-8 rounded-lg border border-border px-4 py-3 dark:border-border-dark">
    <summary class="cursor-pointer text-sm font-medium text-text-main dark:text-text-dark-main">
      Notes de méthode
    </summary>
    <ul
      class="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-text-muted dark:text-text-dark-muted"
    >
      <li>
        Une métrique marquée « données insuffisantes » n'affiche ni valeur ni graphique. Un graphe
        vide est plus honnête qu'un graphe faux.
      </li>
      <li v-if="bridge?.truncated">
        L'indice de référence n'a pas d'historique sur toute ta période : la comparaison démarre au
        {{ bridge.covered_from }}, sur {{ bridge.covered_days }} jours.
      </li>
      <li>
        Le pont contrefactuel substitue tes décisions dans cet ordre :
        {{ bridge?.order.join(' → ') }}.
      </li>
    </ul>
  </details>

  <details class="mt-3 rounded-lg border border-border px-4 py-3 dark:border-border-dark">
    <summary class="cursor-pointer text-sm font-medium text-text-main dark:text-text-dark-main">
      Ce que cette page ne calcule pas, et pourquoi
    </summary>
    <ul
      class="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-text-muted dark:text-text-dark-muted"
    >
      <li>
        <strong>Sharpe, Sortino, ratio d'information.</strong> Sur deux ans, c'est du bruit : la
        t-stat d'un ratio d'information vaut environ IR·√T, il faudrait un IR supérieur à 1,4 pour
        que le chiffre soit significatif. Les afficher échouerait au test du « et donc ? ».
      </li>
      <li>
        <strong>Alpha et bêta contre le marché.</strong> Même problème d'échantillon, et redondant
        avec les paris indépendants ci-dessus.
      </li>
      <li>
        <strong>Le drawdown maximal en chiffre-titre.</strong> Descriptif, non actionnable, et déjà
        lisible sur la courbe d'évolution.
      </li>
      <li>
        <strong>L'attribution sectorielle (Brinson–Fachler).</strong> Elle exige les poids
        sectoriels du portefeuille et de l'indice. Sans la composition des ETF, ce serait de la
        fabrication.
      </li>
      <li>
        <strong>L'implementation shortfall (Perold, 1988).</strong> Il exige l'horodatage du moment
        où tu as décidé, que l'app ne collecte pas. Il n'est ni calculé ni prétendu.
      </li>
      <li>
        <strong>La composition réelle de tes ETF (look-through).</strong> Elle demanderait une
        source externe. Sans elle, impossible de dire « tu détiens Apple deux fois » — seulement à
        quel point tes lignes bougent ensemble.
      </li>
    </ul>
  </details>
</template>
