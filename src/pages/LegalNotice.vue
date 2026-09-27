<script setup lang="ts">
import LegalLayout from '@/components/public/LegalLayout.vue'
import LegalSection from '@/components/public/LegalSection.vue'
import { contactEmail, owner, sourceRepos } from '@/components/public/siteInfo'
</script>

<template>
  <LegalLayout title="Mentions légales">
    <template #intro>Qui édite ce site, où il est hébergé et comment joindre son auteur.</template>

    <LegalSection heading="Éditeur">
      <p>
        CapitalView est édité par <strong>{{ owner }}</strong>, en France, qui en est aussi le directeur de la publication.
      </p>
      <p>Contact&nbsp;: <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a></p>
    </LegalSection>

    <LegalSection heading="Hébergement">
      <p>
        Le site et sa base de données tournent sur un serveur exploité par l'éditeur lui-même, en France.
      </p>
      <p>
        Le trafic y parvient par <strong>Cloudflare, Inc.</strong>, 101 Townsend St, San Francisco, CA 94107, États-Unis,
        qui l'achemine jusqu'à ce serveur.
      </p>
    </LegalSection>

    <LegalSection heading="Code source">
      <p>
        Le code de l'application est open source, sous licence
        <a href="https://www.gnu.org/licenses/agpl-3.0.html">GNU AGPL 3.0</a>&nbsp;:
        vous pouvez vérifier qu'il fait ce que ces pages décrivent.
      </p>
      <ul>
        <li v-for="repo in sourceRepos" :key="repo.url">
          {{ repo.label }}&nbsp;: <a :href="repo.url">{{ repo.url.replace('https://', '') }}</a>
        </li>
      </ul>
    </LegalSection>

    <LegalSection heading="Données personnelles">
      <p>
        Ce que le service conserve, pourquoi et pour combien de temps&nbsp;:
        <router-link to="/confidentialite">politique de confidentialité</router-link>.
      </p>
    </LegalSection>
  </LegalLayout>
</template>
