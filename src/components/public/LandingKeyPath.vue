<script setup lang="ts">
/**
 * Where the master key goes, as a picture of the security section's claims.
 * It only restates what the text around it says; change both together.
 */
import { ArrowDown, ArrowRight } from 'lucide-vue-next'

const stops = [
  {
    place: 'Votre navigateur',
    items: [
      { label: 'Votre mot de passe', text: 'saisi à la connexion' },
      { label: 'Un cookie', text: 'porte la clé maître, hors de portée du JavaScript de la page, 7 jours au plus' },
    ],
    hop: 'le cookie accompagne chaque requête',
  },
  {
    place: 'Le serveur, le temps d\'une requête',
    items: [
      { label: 'Déverrouille', text: 'la clé maître avec votre mot de passe, à la connexion' },
      { label: 'Déchiffre et calcule', text: 'soldes, plus-values, graphiques' },
      { label: 'Oublie la clé', text: 'une fois la réponse envoyée' },
    ],
    hop: 'n\'écrit que du chiffré',
  },
  {
    place: 'La base de données',
    items: [
      { label: 'Des enveloppes', text: 'la clé maître, chiffrée par votre mot de passe ou votre clé de récupération' },
      { label: 'Des montants chiffrés', text: 'illisibles sans la clé' },
      { label: 'Des empreintes', text: 'à la place de votre identifiant' },
    ],
    hop: null,
  },
]
</script>

<template>
  <figure>
    <figcaption class="pb-3 border-b-2 border-text-main dark:border-text-dark-main font-display text-lg font-semibold text-text-main dark:text-text-dark-main">
      Le trajet de votre clé
    </figcaption>
    <ol class="grid lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
      <template v-for="stop in stops" :key="stop.place">
        <li class="py-6">
          <p class="text-sm font-semibold uppercase tracking-wide text-primary">{{ stop.place }}</p>
          <ul class="mt-4 space-y-3">
            <li v-for="item in stop.items" :key="item.label" class="pl-3 border-l-2 border-surface-border dark:border-surface-dark-border">
              <span class="block font-semibold text-text-main dark:text-text-dark-main">{{ item.label }}</span>
              <span class="block text-sm leading-relaxed text-text-muted dark:text-text-dark-muted text-pretty">{{ item.text }}</span>
            </li>
          </ul>
        </li>
        <li
          v-if="stop.hop"
          class="flex lg:flex-col items-center justify-center gap-2 lg:px-6 py-2 lg:py-6 text-xs text-text-muted dark:text-text-dark-muted"
        >
          <ArrowDown class="w-5 h-5 lg:hidden text-primary" aria-hidden="true" />
          <ArrowRight class="hidden lg:block w-5 h-5 text-primary" aria-hidden="true" />
          <span class="lg:max-w-24 lg:text-center text-balance">{{ stop.hop }}</span>
        </li>
      </template>
    </ol>
  </figure>
</template>
