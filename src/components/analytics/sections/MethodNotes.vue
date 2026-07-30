<script setup lang="ts">
/**
 * The conventions the page rests on, and the indicators it deliberately does not
 * compute. A missing indicator has to be a visible choice, not an oversight.
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
        <strong>Achat ≠ dépôt.</strong> Tout ce qui juge ton comportement d'investissement est
        calculé sur tes <strong>achats</strong>. Les dépôts ne servent qu'à trois choses : la
        performance réelle de tes euros, le délai avant investissement, et le coût du cash resté
        dormant.
      </li>
      <li>
        Le prix de référence d'un achat est la <strong>moyenne des clôtures journalières</strong>
        de son mois calendaire (TWAP). Ce n'est pas un VWAP : les volumes intra-journaliers ne sont
        pas stockés. Le véritable <em>implementation shortfall</em> demanderait un horodatage de
        décision qui n'est pas collecté — il n'est ni calculé ni prétendu.
      </li>
      <li>
        Le pont contrefactuel est <strong>dépendant du chemin</strong> : l'ordre des substitutions
        ({{ bridge?.order.join(' → ') }}) est un choix, et le réordonner déplacerait quelques euros
        entre termes voisins. La somme des termes réconcilie exactement avec ton portefeuille ;
        tout reliquat apparaît comme « non expliqué » plutôt que d'être absorbé.
      </li>
      <li>
        Le robot part du <strong>même capital effectivement investi que toi</strong>, et se voit
        attribuer les mêmes liquidités non investies. Sans ça, un gros dépôt laissé dormant se
        lirait comme du talent d'investisseur.
      </li>
      <li>
        L'<strong>indice de concentration temporelle</strong> (HHI) appliqué à la répartition de
        ton capital dans le temps est un usage maison : l'indice est standard, le porter sur l'axe
        du temps est une lecture propre à cette page. Son inverse se lit en « achats mensuels égaux
        équivalents ».
      </li>
      <li>
        <strong>Deux conventions de coût coexistent</strong>, pour deux objets différents : le
        délai dépôt → achat suit un <strong>FIFO sur les liquidités</strong> (on suit un euro), là
        où les plus-values réalisées de l'app utilisent le <strong>coût moyen pondéré</strong>. Ce
        n'est pas une incohérence, et aligner les deux ferait dire à cette page l'inverse de tes
        encarts de la page Bourse.
      </li>
      <li>
        L'état du marché est mesuré en <strong>séances</strong>, jamais en jours calendaires, et un
        jour dont l'année glissante précédente n'est pas complète est écarté : un plus-haut calculé
        sur une fenêtre tronquée afficherait un écart quasi nul et se lirait à tort comme un achat
        dans le creux.
      </li>
      <li>
        Les tests de permutation re-tirent tes achats au hasard (5 000 fois) en gelant tout le
        reste. Le tirage est <strong>à graine fixe</strong> : deux consultations donnent le même
        résultat. Au-delà de p = 0,10, la page dit « rien de détectable » — jamais « tu es bon ».
      </li>
      <li v-if="bridge?.truncated">
        L'indice de référence n'a pas d'historique sur toute ta période : la comparaison démarre au
        {{ bridge.covered_from }}, sur {{ bridge.covered_days }} jours.
      </li>
      <li>
        Le <strong>coût des sorties</strong> compare la ligne vendue à l'indice sur un horizon fixe
        d'un an. Les ventes trop récentes pour cet horizon sont exclues et comptées, jamais
        évaluées sur quelques semaines.
      </li>
      <li>
        Le <strong>taux de rotation</strong> retient le plus petit des deux côtés, achats ou
        ventes : accumuler n'est pas tourner son portefeuille.
      </li>
      <li>
        Le <strong>plan cible</strong> n'est évalué qu'à partir du mois que tu déclares, et sur les
        mois complets uniquement. Appliqué rétroactivement, il produirait un verdict sur des mois
        où tu n'avais rien promis ; en comptant le mois en cours, il montrerait un
        sous-investissement à chaque ouverture de la page.
      </li>
      <li>
        Une métrique marquée « données insuffisantes » n'affiche ni valeur ni graphique. Un graphe
        vide est plus honnête qu'un graphe faux.
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
