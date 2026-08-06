/**
 * Le sélecteur de ligne, rendu côté serveur comme les sections.
 *
 * Ce qui compte ici n'est pas l'interaction — c'est ce qui est écrit à l'écran
 * au repos : un nom, et l'ISIN en second. Le réglage demandait l'inverse.
 */
import { describe, it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import AssetKeyPicker from '@/components/analytics/AssetKeyPicker.vue'

const ASSETS = [
  {
    asset_key: 'IE00B4L5Y983',
    symbol: 'IWDA.AS',
    name: 'iShares Core MSCI World',
    held: true,
    invested_eur: '12000',
    first_bought: '2024-01-05',
    last_activity: '2025-06-05',
  },
  {
    asset_key: 'FR0000120073',
    symbol: 'AI.PA',
    name: 'Air Liquide',
    held: false,
    invested_eur: '2000',
    first_bought: '2024-02-05',
    last_activity: '2024-06-05',
  },
]

function render(props: Record<string, unknown>) {
  return renderToString(createSSRApp(AssetKeyPicker, { assets: ASSETS, ...props }))
}

describe('AssetKeyPicker', () => {
  it('montre le nom en premier et la clé en second', async () => {
    const html = await render({ modelValue: 'IE00B4L5Y983' })

    expect(html).toContain('iShares Core MSCI World')
    // La clé reste visible — comme confirmation, jamais comme la question posée.
    expect(html).toContain('IWDA.AS · IE00B4L5Y983')
  })

  it('invite à choisir plutôt qu’à saisir quand rien n’est sélectionné', async () => {
    const html = await render({ modelValue: '' })

    expect(html).toContain('Choisir une ligne')
    expect(html).not.toContain('IE00B4L5Y983')
  })

  it('retombe sur la saisie libre pour une clé absente du portefeuille', async () => {
    // Un ISIN stocké que l'utilisateur ne détient pas ne doit pas être effacé.
    const html = await render({ modelValue: 'LU1681043599' })

    expect(html).toContain('LU1681043599')
    expect(html).toContain('input')
  })

  it('reste utilisable sans aucune ligne connue', async () => {
    const html = await render({ modelValue: 'LU1681043599', assets: [] })

    expect(html).toContain('LU1681043599')
  })

  it('s’annonce comme une liste déroulante, nommée par la ligne choisie', async () => {
    // Le déclencheur est une icône plus un nom tronqué : sans nom accessible,
    // un lecteur d'écran n'annonce qu'un bouton vide.
    const html = await render({ modelValue: 'IE00B4L5Y983' })

    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Ligne : iShares Core MSCI World"')
  })

})

/*
 * Ce que ces tests ne couvrent pas : la liste ouverte.
 *
 * Le rendu serveur ne monte jamais le composant, donc `isOpen` reste faux et
 * tout ce qui vit dans la liste déroulante — flèches, `aria-activedescendant`,
 * unicité des identifiants entre deux sélecteurs — est hors de portée. Le dépôt
 * n'a pas de framework de test de composants, et en ajouter un était un choix
 * plus lourd que ce que ce changement justifie.
 */
