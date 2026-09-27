<script setup lang="ts">
import { ArrowRight, ChevronDown } from 'lucide-vue-next'

import { defineAsyncComponent } from 'vue'
import { BaseTerm } from '@/components'
import PublicNav from '@/components/public/PublicNav.vue'
import { focusRing, primaryButton, textLink } from '@/components/public/publicStyles'

// Charts are heavy and sit below the fold.
const LandingDemo = defineAsyncComponent(() => import('@/components/public/LandingDemo.vue'))

// Column names are the real ones from the API models.
const specimen = [
  { field: 'Titulaire', plain: 'Vous', column: 'user_uuid_bidx', cipher: 'k4TQv0yZr8Wm2HcX1bJpN7aLfE9sUdGq3oRtYiKw6Vc=' },
  { field: 'IBAN', plain: 'FR76 1234 5678 9012 3456 7890 123', column: 'identifier_enc', cipher: 'oXm9k3LpQ2vR8wZt1nBfY6cHjD4eKgMxUaSiNq…' },
  { field: 'Solde', plain: '24 650,83 €', column: 'balance_enc', cipher: 'Wq7pRmK2Nv5tYxHn8bCfLj3gDsAoUeZiVrTkMw…' },
  { field: 'Note', plain: 'Renforcer le PEA si le CAC 40 repasse sous 7 000', column: 'description_enc', cipher: 'Fh4yBnWq9kRm2Lv7tPxHcJf5gDsAoZeNiUrTkQ…' },
]

const modules = [
  { name: 'Banque', text: 'Relevés CSV, livrets aux intérêts comptés par quinzaine, revenus et dépenses récurrents repérés.' },
  { name: 'Cashflow', text: 'Ce qui entre, ce qui sort et ce qui reste chaque mois.' },
  { name: 'Bourse', text: 'Comptes-titres et PEA, imports Degiro et Trade Republic.' },
  { name: 'Crypto', text: 'Imports Binance, Coinbase et Kraken.' },
  { name: 'Assurance vie', text: 'Versements, rachats et relevés de valeur.' },
  { name: 'Biens', text: 'Véhicules, bijoux, collections et leurs estimations.' },
  { name: 'Analyse', text: 'Répartition dans le temps, contribution de chaque ligne.' },
  { name: 'Notes', text: 'Vos thèses et décisions, chiffrées comme le reste.' },
]

// One PEA line, computed the way the API does: buy fees are part of the cost basis.
const buys = [
  { date: '10 févr.', quantity: 40, price: '98,50', fees: '2,00', cost: '3 942,00' },
  { date: '12 sept.', quantity: 25, price: '104,20', fees: '2,00', cost: '2 607,00' },
]
</script>

<template>
  <div class="cv-public min-h-screen bg-background dark:bg-background-dark text-text-body dark:text-text-dark-body">
    <PublicNav />

    <!-- Hero: the claim, then the proof of it -->
    <header class="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-12 gap-x-12 gap-y-12 items-center">
      <div class="lg:col-span-6">
        <h1 class="text-[2.5rem] leading-[1.06] sm:text-6xl sm:leading-[1.03] font-semibold text-text-main dark:text-text-dark-main text-balance">
          Tout votre patrimoine, chiffré avec votre clé.
        </h1>
        <p class="mt-6 text-lg leading-relaxed max-w-[34rem] text-pretty">
          Comptes courants, livrets, PEA, assurance vie, crypto et biens dans une seule vue, avec des plus-values calculées sur votre prix de revient.
          Chaque montant est chiffré avant d'être enregistré, avec une clé que le serveur ne garde pas.
        </p>
        <div class="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <router-link to="/register" :class="primaryButton">Créer un compte</router-link>
          <a href="#securite" :class="['group min-h-11 inline-flex items-center gap-2 rounded-button font-semibold text-primary', focusRing]">
            Voir ce que le serveur stocke
            <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>

      <figure class="lg:col-span-6">
        <figcaption class="flex items-baseline justify-between gap-4 pb-3 border-b-2 border-text-main dark:border-text-dark-main">
          <span class="font-display text-lg font-semibold text-text-main dark:text-text-dark-main">Un compte, deux lectures</span>
          <span class="text-sm text-text-muted dark:text-text-dark-muted">exemple</span>
        </figcaption>
        <dl>
          <div class="hidden sm:grid grid-cols-[6rem_1fr_1fr] gap-x-6 py-2.5 border-b border-surface-border dark:border-surface-dark-border text-xs font-semibold text-text-muted dark:text-text-dark-muted" aria-hidden="true">
            <span></span>
            <span>Ce que vous voyez</span>
            <span>Ce que la base contient</span>
          </div>
          <div
            v-for="(row, i) in specimen"
            :key="row.field"
            class="grid sm:grid-cols-[6rem_1fr_1fr] gap-x-6 gap-y-1.5 py-4 border-b border-surface-border dark:border-surface-dark-border"
          >
            <dt class="text-sm text-text-muted dark:text-text-dark-muted">{{ row.field }}</dt>
            <dd class="cv-figure text-lg leading-snug text-text-main dark:text-text-dark-main">
              <span class="sr-only">En clair&nbsp;: </span>{{ row.plain }}
            </dd>
            <dd class="font-mono text-xs leading-relaxed break-all">
              <span class="sr-only">En base&nbsp;: </span>
              <span class="block text-text-muted dark:text-text-dark-muted">{{ row.column }}</span>
              <span class="cipher-reveal block text-primary" :style="{ '--i': i }">{{ row.cipher }}</span>
            </dd>
          </div>
        </dl>
      </figure>
    </header>

    <!-- The product itself -->
    <section class="border-t border-surface-border dark:border-surface-dark-border" aria-labelledby="apercu">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
        <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
          <h2 id="apercu" class="lg:col-span-7 text-3xl sm:text-4xl leading-tight font-semibold text-text-main dark:text-text-dark-main text-balance">
            Où en est votre argent, en un coup d'œil
          </h2>
          <p class="lg:col-span-5 text-pretty">
            Chaque rubrique alimente la même vue d'ensemble, sur téléphone comme sur ordinateur.
          </p>
        </div>

        <div class="mt-12">
          <LandingDemo />
        </div>

        <dl class="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10">
          <div v-for="item in modules" :key="item.name" class="py-4 border-t border-surface-border dark:border-surface-dark-border">
            <dt class="font-semibold text-text-main dark:text-text-dark-main">{{ item.name }}</dt>
            <dd class="mt-1 text-sm leading-relaxed text-text-muted dark:text-text-dark-muted text-pretty">{{ item.text }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- One figure, taken apart -->
    <section class="border-t border-surface-border dark:border-surface-dark-border" aria-labelledby="calcul">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid lg:grid-cols-12 gap-x-12 gap-y-10">
        <div class="lg:col-span-5">
          <h2 id="calcul" class="text-3xl sm:text-4xl leading-tight font-semibold text-text-main dark:text-text-dark-main text-balance">
            D'où vient ce chiffre
          </h2>
          <p class="mt-4 leading-relaxed text-pretty">
            Une plus-value n'a de sens que si l'on sait comment elle est calculée. Voici une ligne de PEA, détaillée comme l'application la calcule.
          </p>
          <p class="mt-10 text-sm text-text-muted dark:text-text-dark-muted">ETF Monde, PEA, exemple</p>
          <p class="cv-figure mt-1 text-5xl sm:text-6xl font-semibold text-text-main dark:text-text-dark-main">+757,00&nbsp;€</p>
          <p class="mt-2 text-lg">soit +11,56&nbsp;% de ce que vous avez investi</p>
        </div>

        <div class="lg:col-start-7 lg:col-span-6 lg:pt-2">
          <table class="w-full text-sm">
            <caption class="sr-only">Calcul de la plus-value latente de la ligne d'exemple</caption>
            <tbody>
              <tr v-for="buy in buys" :key="buy.date" class="border-b border-surface-border dark:border-surface-dark-border">
                <th scope="row" class="py-3 pr-4 text-left font-normal align-top">
                  Achat du {{ buy.date }}
                  <span class="block text-xs text-text-muted dark:text-text-dark-muted">{{ buy.quantity }} parts × {{ buy.price }}&nbsp;€ + {{ buy.fees }}&nbsp;€ de frais, import CSV du courtier</span>
                </th>
                <td class="py-3 text-right align-top text-text-main dark:text-text-dark-main">{{ buy.cost }}&nbsp;€</td>
              </tr>
              <tr class="border-b-2 border-text-main dark:border-text-dark-main">
                <th scope="row" class="py-3 pr-4 text-left font-semibold text-text-main dark:text-text-dark-main">
                  Investi, frais compris
                  <span class="block text-xs font-normal text-text-muted dark:text-text-dark-muted">65 parts, prix de revient 100,75&nbsp;€ par part</span>
                </th>
                <td class="py-3 text-right font-semibold text-text-main dark:text-text-dark-main">6&#8239;549,00&nbsp;€</td>
              </tr>
              <tr class="border-b border-surface-border dark:border-surface-dark-border">
                <th scope="row" class="py-3 pr-4 text-left font-normal">
                  Valeur aujourd'hui
                  <span class="block text-xs text-text-muted dark:text-text-dark-muted">65 parts × 112,40&nbsp;€, dernier cours connu</span>
                </th>
                <td class="py-3 text-right text-text-main dark:text-text-dark-main">7&#8239;306,00&nbsp;€</td>
              </tr>
              <tr>
                <th scope="row" class="py-3 pr-4 text-left font-semibold text-text-main dark:text-text-dark-main">
                  Plus-value latente
                  <span class="block text-xs font-normal text-text-muted dark:text-text-dark-muted">valeur − investi, puis ÷ investi pour le pourcentage</span>
                </th>
                <td class="py-3 text-right font-semibold text-text-main dark:text-text-dark-main">+757,00&nbsp;€</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Security: the central argument, stated exactly -->
    <section
      id="securite"
      class="scroll-mt-16 bg-background-subtle dark:bg-background-dark-subtle border-y border-surface-border dark:border-surface-dark-border"
      aria-labelledby="securite-titre"
    >
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
        <h2 id="securite-titre" class="max-w-2xl text-3xl sm:text-4xl leading-tight font-semibold text-text-main dark:text-text-dark-main text-balance">
          Ce que le serveur sait de vous
        </h2>
        <p class="mt-4 max-w-2xl text-lg leading-relaxed text-pretty">
          Voici exactement ce qui est protégé, comment, et ce qui ne l'est pas.
        </p>

        <div class="mt-14 grid md:grid-cols-2 gap-x-12">
          <div class="py-7 border-t border-text-main/15 dark:border-text-dark-main/15">
            <h3 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Mot de passe oublié&nbsp;: seule la clé de récupération sauve vos données</h3>
            <p class="mt-3 leading-relaxed text-pretty">
              Une clé de récupération vous est remise à l'inscription. Sans elle, un mot de passe oublié rend vos données illisibles pour de bon&nbsp;:
              personne ne peut le réinitialiser à votre place, et aucun e-mail ne le fera.
            </p>
          </div>
          <div class="py-7 border-t border-text-main/15 dark:border-text-dark-main/15">
            <h3 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Vos montants sont chiffrés en base</h3>
            <p class="mt-3 leading-relaxed text-pretty">
              Soldes, libellés, numéros de compte, notes&nbsp;: chaque valeur est chiffrée avec une clé propre à votre compte avant d'être écrite.
              Une copie volée de la base ne révèle aucun montant, tant que votre mot de passe est solide.
            </p>
          </div>
          <div class="py-7 border-t border-text-main/15 dark:border-text-dark-main/15">
            <h3 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Rien dans la base ne les relie à vous</h3>
            <p class="mt-3 leading-relaxed text-pretty">
              Vos comptes, soldes et notes ne portent pas votre identifiant, mais une empreinte calculée avec votre clé.
              Sans elle, impossible de les rattacher à votre profil.
            </p>
          </div>
          <div class="py-7 border-t border-text-main/15 dark:border-text-dark-main/15">
            <h3 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Votre clé n'est jamais écrite en base</h3>
            <p class="mt-3 leading-relaxed text-pretty">
              Pour calculer vos plus-values, le serveur doit lire vos données pendant la requête.
              La clé l'accompagne donc, dans un cookie inaccessible au JavaScript de la page, et le serveur ne la conserve pas entre deux requêtes.
              Ce n'est pas du chiffrement de bout en bout&nbsp;: c'est un chiffrement au repos dont le serveur n'a pas la clé.
            </p>
          </div>
        </div>

        <div class="mt-6 pt-7 border-t border-text-main/15 dark:border-text-dark-main/15 max-w-3xl text-sm leading-relaxed text-text-muted dark:text-text-dark-muted text-pretty">
          <p>
            <strong class="font-semibold text-text-main dark:text-text-dark-main">Ce qui reste lisible.</strong>
            Votre e-mail et votre nom d'utilisateur, pour vous connecter&nbsp;; vos réglages (taux d'imposition, modules activés)&nbsp;;
            les types de comptes et leurs dates d'ouverture et d'historique&nbsp;; le journal des calculs lancés pour votre compte&nbsp;;
            le nombre de lignes qui partagent une même empreinte. Ce que vous publiez dans la Communauté est, par définition, lisible par les autres membres et par le serveur.
          </p>
          <p class="mt-3">
            <strong class="font-semibold text-text-main dark:text-text-dark-main">Ce qui sort du serveur.</strong>
            Si vous activez l'IA, les données concernées partent chez le fournisseur que vous avez choisi, avec votre propre clé d'accès&nbsp;;
            si vous reliez une banque, c'est Enable Banking qui transmet vos opérations. Les polices de ces pages viennent de Google Fonts,
            et les visites sont comptées par une mesure d'audience sans cookie (Umami).
          </p>
        </div>

        <details class="group mt-10 border-t-2 border-text-main dark:border-text-dark-main">
          <summary :class="['flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden', focusRing]">
            <span class="font-display text-xl font-semibold text-text-main dark:text-text-dark-main">Détails techniques</span>
            <ChevronDown class="w-5 h-5 shrink-0 text-text-muted dark:text-text-dark-muted transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-180 group-hover:text-text-main dark:group-hover:text-text-dark-main" />
          </summary>
          <ol class="pb-4 max-w-3xl">
            <li class="grid sm:grid-cols-[11rem_1fr] gap-x-8 gap-y-1 py-5 border-t border-text-main/15 dark:border-text-dark-main/15">
              <p class="font-semibold text-text-main dark:text-text-dark-main">Clé maître</p>
              <p class="leading-relaxed text-pretty">
                Tirée au hasard à l'inscription, 256 bits.
                Elle ne dépend pas de votre mot de passe, qui peut donc changer sans rechiffrer vos données.
              </p>
            </li>
            <li class="grid sm:grid-cols-[11rem_1fr] gap-x-8 gap-y-1 py-5 border-t border-text-main/15 dark:border-text-dark-main/15">
              <p class="font-semibold text-text-main dark:text-text-dark-main">Enveloppes</p>
              <p class="leading-relaxed text-pretty">
                Une clé dérivée de votre mot de passe par
                <BaseTerm term="Argon2id">Fonction de dérivation de mots de passe (RFC 9106). Son coût en mémoire rend les attaques massives par carte graphique trop chères.</BaseTerm>
                (64 Mio, 2 passes, sel aléatoire de 16 octets propre à votre compte) chiffre la clé maître.
                La clé de récupération en produit une seconde enveloppe, chaque jeton d'API que vous créez une autre.
                Seules ces enveloppes sont en base.
              </p>
            </li>
            <li class="grid sm:grid-cols-[11rem_1fr] gap-x-8 gap-y-1 py-5 border-t border-text-main/15 dark:border-text-dark-main/15">
              <p class="font-semibold text-text-main dark:text-text-dark-main">Sous-clés</p>
              <p class="leading-relaxed text-pretty">
                <BaseTerm term="HKDF-SHA256">Fonction de dérivation de clés (RFC 5869). Elle produit plusieurs clés indépendantes à partir d'une seule, selon un contexte.</BaseTerm>
                tire de la clé maître deux clés indépendantes, l'une pour chiffrer, l'autre pour calculer les empreintes.
              </p>
            </li>
            <li class="grid sm:grid-cols-[11rem_1fr] gap-x-8 gap-y-1 py-5 border-t border-text-main/15 dark:border-text-dark-main/15">
              <p class="font-semibold text-text-main dark:text-text-dark-main">Chiffrement</p>
              <p class="leading-relaxed text-pretty">
                <BaseTerm term="AES-256-GCM">Chiffrement authentifié : il protège la confidentialité de la donnée et détecte toute modification du texte chiffré.</BaseTerm>,
                avec un nonce aléatoire de 12 octets par valeur. Une donnée altérée en base est refusée au déchiffrement.
              </p>
            </li>
            <li class="grid sm:grid-cols-[11rem_1fr] gap-x-8 gap-y-1 py-5 border-t border-text-main/15 dark:border-text-dark-main/15">
              <p class="font-semibold text-text-main dark:text-text-dark-main">Empreintes</p>
              <p class="leading-relaxed text-pretty">
                <BaseTerm term="HMAC-SHA256">Empreinte à clé (RFC 2104) : la même entrée donne toujours la même empreinte, mais on ne peut ni la calculer sans la clé ni remonter à l'entrée.</BaseTerm>
                de vos identifiants, avec la sous-clé dédiée. Le serveur retrouve vos lignes sans savoir à qui elles appartiennent.
              </p>
            </li>
            <li class="grid sm:grid-cols-[11rem_1fr] gap-x-8 gap-y-1 py-5 border-t border-text-main/15 dark:border-text-dark-main/15">
              <p class="font-semibold text-text-main dark:text-text-dark-main">Session</p>
              <p class="leading-relaxed text-pretty">
                La clé maître voyage dans un cookie
                <BaseTerm term="HttpOnly">Le navigateur l'envoie au serveur, mais le JavaScript de la page ne peut pas le lire.</BaseTerm>
                (Secure en production), valable 7 jours au plus et supprimé à la déconnexion.
                Avec la double authentification, elle patiente entre les deux étapes dans un jeton chiffré par le serveur, valable 5 minutes, que garde votre navigateur.
              </p>
            </li>
          </ol>
        </details>
      </div>
    </section>

    <!-- Closing -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20 flex flex-wrap items-center justify-between gap-6">
      <h2 class="text-2xl sm:text-3xl leading-tight font-semibold text-text-main dark:text-text-dark-main text-balance">
        Commencez par un compte, ajoutez le reste à votre rythme.
      </h2>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-4">
        <router-link to="/register" :class="primaryButton">Créer un compte</router-link>
        <router-link to="/login" :class="['min-h-11 inline-flex items-center', textLink]">J'ai déjà un compte</router-link>
      </div>
    </section>

    <footer class="border-t border-surface-border dark:border-surface-dark-border">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-text-muted dark:text-text-dark-muted">
        <p>&copy; 2026 CapitalView</p>
        <a href="#securite" :class="['min-h-11 inline-flex items-center rounded-button underline underline-offset-4 decoration-surface-border dark:decoration-surface-dark-border hover:text-text-main dark:hover:text-text-dark-main', focusRing]">
          Comment vos données sont chiffrées
        </a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* The page's one moment: the stored form writes itself out next to the plain value. */
@media (prefers-reduced-motion: no-preference) {
  .cipher-reveal {
    animation: cipher-reveal 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(250ms + var(--i) * 110ms);
  }
}
@keyframes cipher-reveal {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
}
</style>
