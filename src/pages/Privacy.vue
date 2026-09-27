<script setup lang="ts">
import LegalLayout from '@/components/public/LegalLayout.vue'
import LegalSection from '@/components/public/LegalSection.vue'
import { contactEmail, owner } from '@/components/public/siteInfo'
</script>

<template>
  <LegalLayout title="Confidentialité">
    <template #intro>
      Ce que CapitalView conserve sur vous, pourquoi, combien de temps, et qui d'autre en voit une partie.
    </template>

    <LegalSection heading="Qui est responsable">
      <p>
        {{ owner }}, qui édite et héberge le service, est responsable de ces traitements.
        Pour toute question ou demande sur vos données&nbsp;: <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>.
      </p>
    </LegalSection>

    <LegalSection heading="Ce qui est conservé">
      <ul>
        <li>
          <strong>Votre compte</strong>, en clair&nbsp;: adresse e-mail et nom d'utilisateur, pour vous connecter et, si vous activez la Communauté, vous y nommer.
          Votre mot de passe n'est pas conservé, seulement son empreinte Argon2id et les enveloppes chiffrées de votre clé.
        </li>
        <li>
          <strong>Vos données financières</strong>&nbsp;: comptes, soldes, opérations, positions, biens et notes que vous saisissez ou importez.
          Elles sont chiffrées avec une clé propre à votre compte, que le serveur ne conserve pas
          (<router-link :to="{ path: '/', hash: '#securite' }">détail du chiffrement et de ses limites</router-link>).
        </li>
        <li>
          <strong>Vos réglages</strong>, en clair&nbsp;: taux d'imposition, modules activés, apparence.
        </li>
        <li>
          <strong>Des informations de fonctionnement</strong>, en clair&nbsp;: les types de vos comptes, les dates de leur historique
          et le journal des calculs lancés pour votre compte.
        </li>
        <li>
          <strong>Ce que vous publiez dans la Communauté</strong>, lisible par les autres membres.
        </li>
        <li>
          <strong>Des compteurs de tentatives.</strong> Connexion, inscription, changement de mot de passe et les autres actions sensibles
          sont comptées pour freiner les attaques, sous une empreinte de votre adresse IP et jamais sous l'adresse elle-même.
        </li>
      </ul>
      <p>
        Le compte, les données et les réglages servent à vous rendre le service que vous demandez en vous inscrivant
        (exécution du contrat, article 6.1.b du RGPD). Les compteurs de tentatives et la mesure d'audience reposent sur l'intérêt
        légitime à protéger le site et à savoir combien de personnes le consultent (article 6.1.f).
        Aucune donnée n'est vendue ni utilisée pour de la publicité.
      </p>
    </LegalSection>

    <LegalSection heading="Qui d'autre en voit une partie">
      <ul>
        <li>
          <strong>Cloudflare</strong> achemine tout le trafic du site. Il déchiffre la connexion HTTPS au passage&nbsp;:
          il voit donc vos requêtes et leurs réponses, y compris le mot de passe saisi à la connexion et le cookie qui porte votre clé.
        </li>
        <li>
          <strong>Google Fonts</strong>&nbsp;: votre navigateur y télécharge les polices du site, Google reçoit donc votre adresse IP.
        </li>
        <li>
          <strong>Umami</strong>, installé sur stats.capitalview.fr, compte les visites sans cookie&nbsp;: page vue, site d'où vous venez,
          type de navigateur et d'appareil, pays.
        </li>
        <li>
          <strong>Enable Banking</strong>, seulement si vous reliez une banque&nbsp;: il transmet vos opérations, et reçoit votre adresse IP
          et le nom de votre navigateur lors de ces échanges.
        </li>
        <li>
          <strong>Le fournisseur d'IA que vous choisissez</strong> (Anthropic, DeepSeek, Google ou OpenRouter), seulement si vous activez l'IA
          avec votre propre clé&nbsp;: il reçoit les données nécessaires à chaque réponse que vous demandez.
        </li>
        <li>
          <strong>CoinGecko, CoinMarketCap et Yahoo Finance</strong> reçoivent du serveur les symboles des actifs à coter,
          sans rien qui vous identifie.
        </li>
      </ul>
      <p>
        Cloudflare, Google et ces fournisseurs d'IA sont établis hors de l'Union européenne&nbsp;: les données qu'ils reçoivent peuvent y être traitées.
      </p>
    </LegalSection>

    <LegalSection heading="Combien de temps">
      <p>
        Tant que votre compte existe. Le supprimer, dans Paramètres&nbsp;›&nbsp;Sécurité, efface aussitôt toutes ses lignes de la base,
        adresse e-mail comprise. Les empreintes d'adresse IP disparaissent après un jour sans nouvelle tentative.
      </p>
    </LegalSection>

    <LegalSection heading="Vos droits">
      <p>
        Vous pouvez accéder à vos données, les corriger, les récupérer, les effacer ou vous opposer à leur traitement
        (articles 15 à 21 du RGPD). L'essentiel se fait sans rien demander, dans Paramètres&nbsp;›&nbsp;Sécurité&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Tout récupérer</strong> avec l'export complet, déchiffré. Comme le serveur n'a pas votre clé, c'est la seule façon
          d'obtenir vos données chiffrées&nbsp;: l'éditeur ne peut pas les extraire à votre place.
        </li>
        <li><strong>Corriger</strong> votre adresse e-mail ou votre nom d'utilisateur.</li>
        <li><strong>Tout effacer</strong> en supprimant votre compte.</li>
      </ul>
      <p>
        Si vous avez perdu à la fois votre mot de passe et votre clé de récupération, écrivez depuis l'adresse du compte à
        <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a> pour le faire supprimer. Même adresse pour toute autre demande.
        Vous pouvez aussi adresser une réclamation à la <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
      </p>
    </LegalSection>

    <LegalSection heading="Cookies et stockage du navigateur">
      <p>
        Deux cookies, posés à la connexion et indispensables au service&nbsp;: l'un garde votre session, l'autre transporte votre clé.
        Le JavaScript de la page ne peut pas les lire, ils durent 7 jours au plus et disparaissent à la déconnexion.
      </p>
      <p>
        Le stockage local du navigateur garde quelques préférences d'affichage (thème, masquage des montants, dernière apparence choisie)&nbsp;; ce stockage n'est pas envoyé au serveur.
        Il n'y a ni cookie publicitaire ni cookie de mesure d'audience&nbsp;: c'est pourquoi le site ne vous demande pas votre consentement.
      </p>
    </LegalSection>
  </LegalLayout>
</template>
