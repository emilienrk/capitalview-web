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
        L'indice de référence n'a pas d'historique sur toute votre période : la comparaison démarre au
        {{ bridge.covered_from }}, sur {{ bridge.covered_days }} jours.
      </li>
      <li>
        Le pont contrefactuel substitue vos décisions dans cet ordre :
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
        <strong>Un alpha ou un ratio d'information affiché seuls.</strong> Sur quelques années,
        la t-stat d'un écart à l'indice vaut environ IR·√T : presque aucun historique de
        particulier ne la fait passer. Le bloc « Risque » montre donc l'écart <em>avec</em> son
        test et le nombre d'années qu'il faudrait pour conclure, et ne le juge jamais sur son
        seul signe. Le « rendement par unité de risque » est un Sharpe sans taux sans risque : le
        taux n'est pas stocké, et il se soustrait des deux côtés.
      </li>
      <li>
        <strong>Le drawdown maximal en chiffre-titre.</strong> Seul, il est descriptif. Il n'est
        montré que face à celui de l'indice sur les mêmes séances, ce qui en fait une comparaison.
      </li>
      <li>
        <strong>L'attribution sectorielle (Brinson–Fachler).</strong> Elle exige les poids
        sectoriels du portefeuille et de l'indice. Sans la composition des ETF, ce serait de la
        fabrication.
      </li>
      <li>
        <strong>L'implementation shortfall (Perold, 1988).</strong> Il exige l'horodatage du moment
        où vous avez décidé, que l'app ne collecte pas. Il n'est ni calculé ni prétendu.
      </li>
      <li>
        <strong>La composition réelle de vos ETF (look-through).</strong> Elle demanderait une
        source externe. Sans elle, impossible de dire « vous détenez Apple deux fois » — seulement à
        quel point vos lignes bougent ensemble.
      </li>
    </ul>
  </details>
</template>
