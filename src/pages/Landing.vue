<script setup lang="ts">
import { ArrowRight, ChevronDown, Moon, Sun } from 'lucide-vue-next'

import { BaseTerm } from '@/components'
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark, setTheme } = useDarkMode()

function toggleDarkMode() {
  setTheme(isDark.value ? 'light' : 'dark')
}

// Column names are the real ones from the API models.
const specimen = [
  { field: 'Titulaire', plain: 'Vous', column: 'user_uuid_bidx', cipher: 'k4TQv0yZr8Wm2HcX1bJpN7aLfE9sUdGq3oRtYiKw6Vc=' },
  { field: 'IBAN', plain: 'FR76 1234 5678 9012 3456 7890 123', column: 'identifier_enc', cipher: 'oXm9k3LpQ2vR8wZt1nBfY6cHjD4eKgMxUaSiNq…' },
  { field: 'Solde', plain: '24\u202f650,83\u00a0€', column: 'balance_enc', cipher: 'Wq7pRmK2Nv5tYxHn8bCfLj3gDsAoUeZiVrTkMw…' },
  { field: 'Note', plain: 'Renforcer le PEA si le CAC\u00a040 repasse sous 7\u202f000', column: 'description_enc', cipher: 'Fh4yBnWq9kRm2Lv7tPxHcJf5gDsAoZeNiUrTkQ…' },
]

const modules = [
  { name: 'Banque', text: 'Comptes synchronisés via Enable Banking ou importés en CSV. Chaque transaction passe en revue, et les revenus et dépenses récurrents sont repérés automatiquement.' },
  { name: 'Cashflow', text: 'Ce qui entre, ce qui sort et ce qui reste chaque mois.' },
  { name: 'Bourse', text: 'Comptes-titres et PEA : positions, historique des ordres et plus-values calculées sur votre prix de revient.' },
  { name: 'Crypto', text: 'Imports Binance, Coinbase et Kraken, plus-values sur le prix de revient, répartition par actif.' },
  { name: 'Assurance vie', text: 'Versements, rachats et relevés de valeur, pour voir ce que le contrat rapporte vraiment.' },
  { name: 'Biens', text: 'Véhicules, bijoux, collections : valeur estimée et historique des estimations.' },
  { name: 'Analyse', text: 'Répartition dans le temps et contribution de chaque ligne à la performance.' },
  { name: 'Notes', text: 'Vos thèses et vos décisions d\'investissement, chiffrées comme le reste.' },
  { name: 'Communauté', text: 'Facultative : partagez vos positions en pourcentage, jamais en montant.' },
]

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
</script>

<template>
  <div class="cv-landing min-h-screen bg-background dark:bg-background-dark text-text-body dark:text-text-dark-body">

    <nav
      class="sticky top-0 z-50 bg-background dark:bg-background-dark border-b border-surface-border dark:border-surface-dark-border"
      style="padding-top: env(safe-area-inset-top);"
    >
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <router-link to="/" :class="['flex items-center gap-2 rounded-button', focusRing]">
          <img src="/capitalview.svg" alt="" class="w-6 h-6" />
          <span class="font-display text-lg font-semibold text-text-main dark:text-text-dark-main">CapitalView</span>
        </router-link>
        <div class="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            :aria-label="isDark ? 'Passer en thème clair' : 'Passer en thème sombre'"
            :class="['size-11 inline-flex items-center justify-center rounded-button text-text-muted dark:text-text-dark-muted hover:text-text-main dark:hover:text-text-dark-main transition-colors', focusRing]"
            @click="toggleDarkMode"
          >
            <Sun v-if="isDark" class="w-5 h-5" />
            <Moon v-else class="w-5 h-5" />
          </button>
          <router-link
            to="/login"
            :class="['min-h-11 inline-flex items-center px-3 rounded-button text-sm font-semibold text-text-main dark:text-text-dark-main hover:text-primary transition-colors', focusRing]"
          >
            Connexion
          </router-link>
          <router-link
            to="/register"
            :class="['hidden sm:inline-flex min-h-11 items-center px-4 rounded-button bg-primary hover:bg-primary-hover text-primary-content text-sm font-semibold transition-colors', focusRing]"
          >
            Créer un compte
          </router-link>
        </div>
      </div>
    </nav>

    <!-- Hero: the claim, then the proof of it -->
    <header class="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-12 gap-x-12 gap-y-14 items-center">
      <div class="lg:col-span-6">
        <h1 class="text-[2.5rem] leading-[1.08] sm:text-6xl sm:leading-[1.04] lg:text-[3.25rem] font-semibold text-text-main dark:text-text-dark-main text-balance">
          Votre patrimoine, lisible par vous seul.
        </h1>
        <p class="mt-6 text-lg leading-relaxed max-w-[34rem] text-pretty">
          Comptes bancaires, bourse, crypto, assurance vie et biens réunis dans une seule vue, avec des plus-values calculées sur votre prix de revient.
          Chaque montant est chiffré avant d'être enregistré&nbsp;: même l'administrateur du serveur ne peut pas lire vos soldes.
        </p>
        <div class="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <router-link
            to="/register"
            :class="['min-h-12 inline-flex items-center px-6 rounded-button bg-primary hover:bg-primary-hover text-primary-content font-semibold transition-colors', focusRing]"
          >
            Créer un compte
          </router-link>
          <a
            href="#securite"
            :class="['group min-h-11 inline-flex items-center gap-2 rounded-button font-semibold text-primary', focusRing]"
          >
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
            <dd class="text-text-main dark:text-text-dark-main tabular-nums">
              <span class="sr-only">En clair&nbsp;: </span>{{ row.plain }}
            </dd>
            <dd class="cipher-reveal font-mono text-xs leading-relaxed break-all" :style="{ '--i': i }">
              <span class="sr-only">En base&nbsp;: </span>
              <span class="block text-text-muted dark:text-text-dark-muted">{{ row.column }}</span>
              <span class="block text-primary">{{ row.cipher }}</span>
            </dd>
          </div>
        </dl>
      </figure>
    </header>

    <!-- What it tracks -->
    <section class="border-t border-surface-border dark:border-surface-dark-border" aria-labelledby="suivi">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
        <h2 id="suivi" class="max-w-2xl text-3xl sm:text-4xl leading-tight font-semibold text-text-main dark:text-text-dark-main text-balance">
          Tout ce que vous possédez, au même endroit
        </h2>
        <p class="mt-4 max-w-xl text-pretty">
          Chaque rubrique alimente la même vue d'ensemble, et chaque chiffre peut être ouvert pour voir d'où il vient.
        </p>
        <dl class="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10">
          <div
            v-for="item in modules"
            :key="item.name"
            class="py-6 border-t border-surface-border dark:border-surface-dark-border"
          >
            <dt class="font-display text-xl font-semibold text-text-main dark:text-text-dark-main">{{ item.name }}</dt>
            <dd class="mt-2 text-[0.9375rem] leading-relaxed text-pretty">{{ item.text }}</dd>
          </div>
        </dl>
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
          Presque rien. Voici exactement ce qui est protégé, comment, et ce qui ne l'est pas.
        </p>

        <div class="mt-14 grid md:grid-cols-2 gap-x-12">
          <div class="py-7 border-t border-text-main/15 dark:border-text-dark-main/15">
            <h3 class="text-xl font-semibold text-text-main dark:text-text-dark-main">La base ne contient que du chiffré</h3>
            <p class="mt-3 leading-relaxed text-pretty">
              Soldes, libellés, numéros de compte, notes&nbsp;: chaque valeur est chiffrée avec une clé propre à votre compte avant d'être écrite.
              Une copie volée de la base ne révèle aucun montant.
            </p>
          </div>
          <div class="py-7 border-t border-text-main/15 dark:border-text-dark-main/15">
            <h3 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Rien ne relie ces données à vous</h3>
            <p class="mt-3 leading-relaxed text-pretty">
              Vos lignes ne portent pas votre identifiant, mais une empreinte calculée avec votre clé.
              Sans elle, personne, administrateur compris, ne peut rattacher un compte, un solde ou une note à votre profil.
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
          <div class="py-7 border-t border-text-main/15 dark:border-text-dark-main/15">
            <h3 class="text-xl font-semibold text-text-main dark:text-text-dark-main">Si vous oubliez votre mot de passe</h3>
            <p class="mt-3 leading-relaxed text-pretty">
              Votre mot de passe déverrouille la clé&nbsp;; lui-même n'est pas conservé, seulement son empreinte.
              Générez une clé de récupération dans les Réglages&nbsp;: sans elle, un mot de passe oublié rend vos données illisibles pour de bon, pour tout le monde.
            </p>
          </div>
        </div>

        <p class="mt-6 pt-7 border-t border-text-main/15 dark:border-text-dark-main/15 max-w-3xl text-sm leading-relaxed text-text-muted dark:text-text-dark-muted text-pretty">
          <strong class="font-semibold text-text-main dark:text-text-dark-main">Ce qui reste lisible.</strong>
          Votre e-mail et votre nom d'utilisateur, nécessaires pour vous connecter&nbsp;; les dates techniques de création et de mise à jour&nbsp;;
          le nombre de lignes qui partagent une même empreinte. Ce que vous publiez dans l'espace Communauté est, par définition, visible des autres membres.
        </p>

        <details class="group mt-10 border-t-2 border-text-main dark:border-text-dark-main">
          <summary :class="['flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden', focusRing]">
            <span class="font-display text-xl font-semibold text-text-main dark:text-text-dark-main">Détails techniques</span>
            <ChevronDown class="w-5 h-5 shrink-0 text-text-muted dark:text-text-dark-muted transition-transform duration-200 group-open:rotate-180" />
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
                Si la double authentification est active, elle est gardée chiffrée par le serveur le temps de saisir le code.
              </p>
            </li>
          </ol>
        </details>
      </div>
    </section>

    <!-- Closing -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
      <h2 class="max-w-2xl text-3xl sm:text-4xl leading-tight font-semibold text-text-main dark:text-text-dark-main text-balance">
        Commencez par un compte, ajoutez le reste à votre rythme.
      </h2>
      <p class="mt-4 max-w-xl leading-relaxed text-pretty">
        L'inscription prend une minute. Pensez ensuite à générer votre clé de récupération dans les Réglages.
      </p>
      <div class="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
        <router-link
          to="/register"
          :class="['min-h-12 inline-flex items-center px-6 rounded-button bg-primary hover:bg-primary-hover text-primary-content font-semibold transition-colors', focusRing]"
        >
          Créer un compte
        </router-link>
        <router-link
          to="/login"
          :class="['min-h-11 inline-flex items-center rounded-button font-semibold text-primary', focusRing]"
        >
          J'ai déjà un compte
        </router-link>
      </div>
    </section>

    <footer class="border-t border-surface-border dark:border-surface-dark-border">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-text-muted dark:text-text-dark-muted">
        <p>&copy; 2026 CapitalView</p>
        <a href="#securite" :class="['underline underline-offset-4 decoration-surface-border dark:decoration-surface-dark-border hover:text-text-main dark:hover:text-text-dark-main rounded-button', focusRing]">
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

<style>
.cv-landing ::selection {
  background: var(--cv-primary-light);
  color: var(--cv-text-main);
}
.dark .cv-landing ::selection {
  color: var(--cv-text-dark-main);
}
</style>
