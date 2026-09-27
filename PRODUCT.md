# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner and a small circle of relatives. Each tracks their own net worth: bank accounts, stocks, crypto, savings products and life insurance. Used as much on a phone (quick daily check of balances and performance) as on a desktop (review sessions: CSV imports, transaction review, recurring flows, analysis).

## Product Purpose

One place for a person's whole net worth, with figures they can trust: cost-basis P/L, cashflow, recurring income and expenses, allocation over time. Success is opening it and understanding where the money stands in seconds, then digging into any figure when needed.

## Positioning

Zero-knowledge storage: the server never holds the decryption key (Argon2id-derived master key, HKDF sub-keys, AES-256-GCM, blind indexes). Even a database administrator cannot read balances, link an account to an amount, or count a user's records.

## Operating Context

- French-language interface, euro as pivot currency.
- Sections: Dashboard, Bank (review, transactions, recurring), Cashflow, Stock, Placements, Wealth, Crypto, Notes, Analysis, Community, Settings.
- Data arrives from bank sync, CSV imports and manual entries.

## Capabilities and Constraints

- Vue 3 + TypeScript + Tailwind v4, charts with ECharts.
- Light and dark themes both supported and must stay first-class.
- Display currency other than EUR is deferred.

## Brand Commitments

- Name: CapitalView. Factual, plain French voice.
- The zero-knowledge security explanation stays the central argument of the landing page.
- The current logo is not binding.

## Evidence on Hand

- Security explanation copy in `src/pages/Landing.vue`.
- No testimonials, user counts or press exist; never fabricate them.

## Product Principles

1. Figures first: every screen answers "where does my money stand" before anything else.
2. Trust is earned by exactness — explain where a number comes from rather than decorate it.
3. Daily glance on mobile and deep review on desktop are equal citizens.
4. Privacy is structural, not a feature badge.
