/**
 * The blocks /analyse can draw, in the order it draws them.
 *
 * Shared with the settings screen so a block added here appears in both places
 * at once. The stored preference lists what is *hidden*, so anything new is on
 * by default rather than missing for everyone already using the app.
 */
export interface AnalysisSection {
  key: string
  label: string
  description: string
}

export const ANALYSIS_SECTIONS: AnalysisSection[] = [
  { key: 'verdict', label: 'Verdict', description: 'Le résumé en une phrase, en tête de page' },
  { key: 'behaviour', label: 'Ce que tu fais vraiment', description: 'Rythme des achats, délai virement→investissement, conditionnement au marché' },
  { key: 'cost', label: 'Ce que ça coûte', description: 'Écart investisseur, pont contrefactuel, prix payé sur chaque achat' },
  { key: 'holdings', label: 'Ce qui est réellement détenu', description: 'Concentration, paris indépendants et rotation du portefeuille' },
  { key: 'fees', label: 'Frais et sorties', description: 'Frais de courtage et ce que deviennent les sorties' },
  { key: 'plan', label: 'Adhérence au plan cible', description: 'Écart entre le plan déclaré et les versements réels' },
  { key: 'method', label: 'Notes de méthode', description: 'Comment chaque chiffre est calculé' },
]

export function isSectionVisible(hidden: string[] | undefined, key: string): boolean {
  return !hidden?.includes(key)
}
