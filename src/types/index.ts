// ─── Authentication ──────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface User {
  username: string
  email: string
  is_active: boolean
  totp_enabled: boolean
  last_username_change: string | null
  last_email_change: string | null
  last_login: string | null
  created_at: string
}

export interface MessageResponse {
  message: string
}

// ─── Two-factor / recovery / password ────────────────────────

/** Step-1 login response when 2FA is enabled. */
export interface TwoFARequiredResponse {
  two_fa_required: true
  pending_token: string
  expires_in: number
}

export interface Login2FARequest {
  pending_token: string
  code: string
}

export interface PasswordChangeRequest {
  current_password: string
  new_password: string
  totp_code?: string
}

export interface AccountDeleteRequest {
  password: string
  totp_code?: string
  /** Must equal the account's own username — the deletion cannot be undone. */
  confirm_username: string
}

export interface RecoveryKeyGenerateRequest {
  password: string
}

export interface RecoveryKeyResponse {
  recovery_key: string
}

export interface RecoverRequest {
  email: string
  recovery_key: string
  new_password: string
  totp_code?: string
}

/** Recovery response: a fresh session plus the single-use replacement key. */
export interface RecoverResponse extends TokenResponse {
  new_recovery_key: string
}

export interface TwoFASetupResponse {
  secret: string
  otpauth_uri: string
}

export interface TwoFAEnableResponse {
  backup_codes: string[]
}

// ─── API tokens (agent / MCP access) ─────────────────────────

/** A token as listed in settings. The secret itself is never returned here. */
export interface ApiToken {
  uuid: string
  name: string
  scopes: string[]
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

/** The mint response — the only time the plaintext token is ever available. */
export interface ApiTokenCreated extends ApiToken {
  token: string
}

export interface ApiTokenCreateRequest {
  password: string
  totp_code?: string
  name: string
  expires_in_days?: number | null
}

/** Where to point an MCP client, as reported by the API. */
export interface McpConnection {
  url: string
  transport: string
  enabled: boolean
}

/** Discriminated result of a login attempt (password step). */
export type LoginOutcome =
  | { status: 'success' }
  | { status: '2fa'; pendingToken: string; expiresIn: number }
  | { status: 'error'; message: string }

// ─── Bank ────────────────────────────────────────────────────

export type BankAccountType =
  | 'CHECKING'
  | 'SAVINGS'
  | 'LIVRET_A'
  | 'LIVRET_DEVE'
  | 'LEP'
  | 'LDD'
  | 'PEL'
  | 'CEL'

export interface BankAccountCreate {
  name: string
  account_type: BankAccountType
  institution_name?: string
  identifier?: string
  balance?: number
  /** ISO 4217 code. Defaults to EUR; refused if no exchange rate is published. */
  currency?: string
  opened_at?: string | null
  /** Savings and livrets only. Rates are decimals (0.025 = 2.5 %/year), gross. */
  interest_rate?: number | null
  boosted_rate?: number | null
  boosted_until?: string | null
  interest_method?: InterestMethod | null
}

/** An interest field left out is kept; null clears it. */
export interface BankAccountUpdate {
  name?: string
  institution_name?: string
  identifier?: string
  balance?: number
  currency?: string
  opened_at?: string | null
  interest_rate?: number | null
  boosted_rate?: number | null
  boosted_until?: string | null
  interest_method?: InterestMethod | null
}

/** By quinzaine (every regulated livret) or by the day. */
export type InterestMethod = 'FORTNIGHTLY' | 'DAILY'

/** GET /bank/interest: one savings account's interest this year, gross of tax. */
export interface SavingsInterestResponse {
  account_id: string
  year: number
  /** The rate in force today. */
  rate: number
  method: InterestMethod
  /** Accrued over the quinzaines (or days) already over. */
  earned: number
  /** The year's total if the balance stays at today's until 31 December. */
  estimated: number
  /** First day counted, when the history starts inside the year. */
  tracked_from: string | null
}

/** Mirrors the API enums of the same names (dtos/bank.py, dtos/banking.py). */

/** Consent state of a linked account. Machine values: the page picks the label. */
export type LinkStatus = 'connected' | 'reconnect_required'

/** Ruling R18. 'estimated' = the curve rests on an available balance (ITAV), the
 *  bank publishing no accounting one; a gap there is expected, not a signal. */
export type ReconciliationStatus = 'reconciled' | 'gap' | 'not_reconcilable' | 'estimated'

/** The branch one account's sync took; 'skipped_daily_cap' is never a failure. */
export type SyncStatus = 'synced' | 'skipped_daily_cap' | 'reconnect_required' | 'error'

export type ExportImportStatus =
  | 'imported'
  | 'unlinked'
  | 'error'
  | 'balance_unavailable'
  | 'curve_error'

export interface BankAccountResponse {
  id: string
  name: string
  institution_name: string | null
  balance: number
  /** The account's own currency. Balances are in it; totals and curves are in EUR. */
  currency: string
  account_type: BankAccountType
  identifier: string | null
  opened_at: string | null
  interest_rate: number | null
  boosted_rate: number | null
  boosted_until: string | null
  /** Null on an account that bears no interest. */
  interest_method: InterestMethod | null
  created_at: string
  updated_at: string
  balance_updated_at: string | null
  /** Attached to a real bank through Enable Banking. */
  is_linked: boolean
  /** Last successful synchronisation (YYYY-MM-DD), null = never. */
  last_synced_at: string | null
  /** null = the period reconciles; a value means a movement is missing or counted twice. */
  reconciliation_gap: number | null
  reconciliation_status?: ReconciliationStatus | null
  link_status: LinkStatus | null
  /** True while the bank has never answered the long history fetch: the account
   *  syncs, but over a history it does not have. */
  history_pending: boolean
  /** Oldest operation date the bank served on its long history fetch (YYYY-MM-DD):
   *  the measured limit of how far back the curve can go. null = never measured. */
  history_served_from: string | null
  /** Why the last sync failed; null once one succeeds. Persisted server-side. */
  sync_error: string | null
  /** Day the bank was last called for this account (YYYY-MM-DD), whatever the outcome. */
  last_sync_attempt_at: string | null
}

export interface BankSummaryResponse {
  /** null when a currency held has no published rate: no total rather than a wrong one. */
  total_balance: number | null
  accounts: BankAccountResponse[]
}

// ─── Connexion bancaire (Enable Banking) ─────────────────────

export interface BankConnectionStatus {
  has_credentials: boolean
  application_id: string | null
}

/** Field absent = unchanged, empty string = deletion. The key is never read back. */
export interface BankConnectionUpdate {
  application_id?: string
  private_key?: string
}

export interface BankConfigCheck {
  configured: boolean
  key_valid: boolean
  application_active: boolean
  callback_url_declared: boolean
  /** The URL to declare as a redirect URL in the Enable Banking portal. */
  callback_url: string
  /** Which Enable Banking environment the application is registered in. */
  environment: 'SANDBOX' | 'PRODUCTION' | null
  error: string | null
}

export interface AspspSummary {
  name: string
  country: string
  logo: string | null
  beta: boolean
  maximum_consent_validity: number
}

export interface BankAuthorizeRequest {
  aspsp_name: string
  aspsp_country: string
}

export interface BankAuthorizeResponse {
  auth_url: string
}

export interface BankSessionAccount {
  /** Durable attachment key: the bank's own account uid dies with the session. */
  identification_hash: string
  name: string | null
  product: string | null
  /** Unusable as a currency (real accounts return the "no currency" ISO code). */
  currency: string | null
  cash_account_type: string | null
  usage: string | null
  account_id: string | null
  linked: boolean
  bank_account_uuid: string | null
}

/**
 * One account's outcome in an Enable Banking synchronisation.
 *
 * `POST /banking/sync` answers 200 even when every account failed — the branch
 * each one took is here and nowhere else, so this payload has to be read.
 * `skipped_daily_cap` is a no-op, never a failure.
 */
export interface BankAccountSyncResult {
  bank_account_uuid: string
  status: SyncStatus
  inserted: number
  updated: number
  skipped: number
  malformed: number
  removed: number
  snapshots_written: number
  reconciliation_gap: string | null
  reconciliation_status: ReconciliationStatus | null
  /** Balance type this sync could read: 'CLBD', 'OTHR' (card) or 'ITAV'. */
  balance_type: string | null
  /** Rows of the feed carrying `balance_after_transaction`. Measurement only:
   *  a bank that fills it gives each day's balance directly. */
  balance_after_rows: number
  detail: string | null
}

/** Response of DELETE /banking/accounts/{uuid}/link. */
export interface BankAccountUnlinkResult {
  bank_account_uuid: string
  transactions_deleted: number
  /**
   * Accounts that were being deduplicated against the detached one and are now
   * scheduled for a full re-seed — whatever it shadowed can finally be stored.
   */
  reseeded_accounts: string[]
}

/** One calendar month of observed movement, in `BankFlowsResponse.currency`. */
export interface BankFlowMonth {
  period: string // YYYY-MM
  inflow: number
  outflow: number
  net: number
  inflow_count: number
  outflow_count: number
}

/** Movements in a currency other than the headline one, reported apart. */
export interface BankFlowCurrencyTotal {
  currency: string
  inflow: number
  outflow: number
}

/**
 * Response of GET /banking/flows — what actually moved on the accounts, as
 * opposed to what the user declared in Flux de trésorerie.
 *
 * Transfers between two of the user's own accounts are out of the totals and
 * reported on their own: money moved is neither income nor spending, but it is
 * not hidden either.
 */
export interface BankFlowsResponse {
  currency: string
  months: BankFlowMonth[]
  inflow: number
  outflow: number
  net: number
  /** Averaged over the months carrying data, not over the requested window. */
  monthly_inflow: number
  monthly_outflow: number
  covered_months: number
  account_count: number
  account_names: string[]
  internal_transfers_excluded: number
  internal_transfers_amount: number
  /** A movement and its cancellation on one account, bound by the user. */
  reversals_excluded: number
  reversals_amount: number
  /** Not yet booked, so deliberately outside the monthly figures. */
  pending_count: number
  pending_inflow: number
  pending_outflow: number
  other_currencies: BankFlowCurrencyTotal[]
}

/**
 * How two operations came to be paired, and whether they count. `suggested` is
 * only offered: both operations keep counting until the user settles it. Every
 * other status keeps the pair out of the totals.
 */
export type BankTransferStatus =
  | 'suggested' | 'savings' | 'recurring' | 'learned' | 'confirmed' | 'reversal' | 'refund'

export type BankTransferDecisionKind = 'transfer' | 'not_transfer' | 'reversal'

/** Response of GET /banking/transfer-questions — pairs and flow questions waiting for the user, by month. */
export interface BankTransferQuestionsResponse {
  total: number
  months: Array<{ period: string; count: number }>
  /** Recurring payments and income to confirm, asked in their own tab. */
  recurring: number
}

/** One stored movement, as the bank reported it. */
export interface BankTransactionItem {
  id: string
  account_id: string
  account_name: string
  /** YYYY-MM-DD */
  operation_date: string | null
  /** Unsigned: the direction is `is_credit`. */
  amount: number
  currency: string
  is_credit: boolean
  /** Not booked yet: listed, but out of the month's totals. */
  is_pending: boolean
  label: string | null
  /** The account on the other side when the movement pairs as an internal transfer. */
  transfer_account_id: string | null
  transfer_account_name: string | null
  /** The movement on the other side, and how the pair was made. */
  transfer_id: string | null
  transfer_status: BankTransferStatus | null
  /** Only on a suggested pair: the other side's label and day, the amount being the same. */
  transfer_label?: string | null
  transfer_date?: string | null
  /** Read from the label: display, filtering, and whether a transfer sent asks a flow question. */
  operation_type: OperationType
  cashflow_type: CashflowType
  type_source: TypeSource
  /** The rule typing it, exact or reached from a nearby label. */
  type_rule_id: string | null
  /** Set on the last operation of a label only the user can type. */
  flow_question: BankFlowQuestion | null
  /** What the user's investment accounts say about it: the evidence that typed it, or a nearby deposit. */
  contribution: BankContributionMatch | null
  /** The counted recurring payment or income it belongs to. */
  recurring: BankRecurringTag | null
  /** Set on the last operation of a series found but not sure enough to count. */
  recurring_question: BankRecurringQuestion | null
}

// ─── Types de flux ───────────────────────────────────────────

export type OperationType = 'CARD' | 'TRANSFER' | 'DIRECT_DEBIT' | 'WITHDRAWAL' | 'INTEREST' | 'UNKNOWN'

/** How an operation counts in the real cashflow, one per operation. */
export type CashflowType = 'INCOME' | 'EXPENSE' | 'SAVING' | 'INVESTMENT' | 'NEUTRAL'

/** What gave an operation its type, strongest first. */
export type TypeSource = 'pair' | 'override' | 'rule' | 'contribution' | 'recurring' | 'default'

/** Every operation reading like this one on its account and direction, or this one alone. */
export type TypeScope = 'label' | 'operation'

/**
 * A movement declared on an investment account that this operation could be.
 * `exact` means the same day and a single candidate: the operation is typed on
 * it. Otherwise it is a nearby amount, shown for the user to judge.
 */
export interface BankContributionMatch {
  account_name: string
  /** YYYY-MM-DD */
  day: string
  amount: number
  /** A deposit into the account, as opposed to a withdrawal out of it. */
  is_deposit: boolean
  exact: boolean
}

export interface BankFlowQuestion {
  choices: CashflowType[]
  /** The operations of the label the answer types. */
  operation_count: number
  /** What those operations add up to: what the answer can move. */
  amount: number
  /** How many of them a deposit declared a few days away could be. */
  hints: number
}

// ─── Récurrent ───────────────────────────────────────────────

/** What comes back: a payment in the debits, an income in the credits. */
export type RecurringDirection = 'expense' | 'income'

export type RecurringCadence =
  | 'weekly' | 'biweekly' | 'fourweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual'

/** `auto`: sure enough to count without asking; `candidate`: found, asked about. */
export type RecurringState = 'auto' | 'confirmed' | 'candidate' | 'refused'

/** `stale`: its account is known only up to `covered_until`, before the next due date. */
export type RecurringStatus = 'active' | 'late' | 'ended' | 'stale'

/**
 * `extra`: off a due date (a prorata, a salary paid early); `cancelled`:
 * refunded or rejected, counts for nothing; `refund`: a credit from a payment's
 * merchant, or a debit the user attached to an income as taken back.
 */
export type RecurringRole = 'regular' | 'extra' | 'cancelled' | 'refund' | 'manual'

/**
 * What a payment is for, or where an income comes from, as the user filed it.
 * Never guessed. Each direction takes its own natures, `other` both.
 */
export type RecurringNature =
  | 'housing' | 'energy' | 'insurance' | 'credit'
  | 'telecom' | 'transport' | 'sport' | 'leisure' | 'software'
  | 'salary' | 'allowance' | 'pension' | 'rental' | 'support' | 'interest'
  | 'other'

export interface BankRecurringTag {
  /** The user's decision; null for one counted without asking and never decided. */
  id: string | null
  key: string
  direction: RecurringDirection
  name: string
  cadence: RecurringCadence
  role: RecurringRole
  state: RecurringState
}

export interface BankRecurringQuestion {
  direction: RecurringDirection
  cadence: RecurringCadence
  amount: number
  variable: boolean
  occurrence_count: number
  /** YYYY-MM-DD */
  since: string
  annual_estimate: number
  /** The names it was paid under before its current one. */
  renamed_from: string[]
}

export type RecurringDecisionKind = 'confirm' | 'refuse'

export interface BankRecurringUpdate {
  name?: string | null
  cadence?: RecurringCadence | null
  /** Null files it back under « À classer »; one of the other direction is refused (422). */
  nature?: RecurringNature | null
  /** YYYY-MM-DD, the day the user ended it. */
  ended_on?: string | null
}

export interface BankRecurringItem {
  /** The user's decision; null for a series never decided. */
  id: string | null
  key: string
  direction: RecurringDirection
  /** Its last operation, to act on it. */
  transaction_id: string
  name: string
  /** What it is for, or where it comes from; null until the user files it. */
  nature: RecurringNature | null
  state: RecurringState
  confidence: string | null
  status: RecurringStatus
  covered_until: string | null
  cadence: RecurringCadence
  variable: boolean
  amount: number
  currency: string
  monthly_equivalent: number
  annual_estimate: number
  paid_last_12_months: number
  first_date: string
  /** The first operation is near the start of the account's history: it may be older. */
  since_at_least: boolean
  last_date: string
  next_date: string
  occurrence_count: number
  extra_count: number
  accounts: string[]
  payment_method: OperationType
  price_changes: Array<{ date: string; before: number; after: number; percent: number }>
  episodes: Array<{ start: string; end: string }>
  renamed: Array<{ date: string; before: string; after: string }>
  refunds: { total: number; items: Array<{ id: string; date: string; amount: number; label: string | null }> }
  ended_on: string | null
}

export type RecurringOperationAction = 'include' | 'exclude'

/** Response of GET /banking/recurring — one direction, active ones first, by monthly amount. */
export interface BankRecurringResponse {
  direction: RecurringDirection
  currency: string
  /** The active ones counted, in `currency`. */
  monthly_total: number
  annual_total: number
  items: BankRecurringItem[]
}

export interface BankTransactionTypeUpdate {
  type: CashflowType
  scope: TypeScope
}

export interface BankTransactionTypeResult {
  transaction: BankTransactionItem
  /** Operations the label's rule now types, pairs left out; 1 for this operation alone. */
  covered_count: number
}

export interface BankTypeRule {
  id: string
  account_id: string
  account_name: string
  is_credit: boolean
  signature: string
  /** The most recent operation it types, null when it types nothing any more. */
  label: string | null
  type: CashflowType
  operation_count: number
  created_at: string
}

// ─── Cashflow réel ───────────────────────────────────────────

/**
 * What moved, by type. `income` and `expenses` are net of their own reversals,
 * `saving` and `investment` of what was taken back; `neutral` is only
 * informative, and `net` what is left once spent, set aside and invested.
 */
export interface RealCashflowTotals {
  income: number
  expenses: number
  saving: number
  investment: number
  neutral: number
  net: number
  /** What the income left once spent, before any was set aside; taken month by month like `one_off`. */
  cashflow: number
  /** Percent of the income not spent, and the part of it set aside or invested; null without income. */
  savings_rate: number | null
  placed_rate: number | null
  /** The part of `expenses` spent on counted recurring payments, already in it. */
  recurring: number
  /** The rest of `expenses`, taken month by month: a median month's is never a difference of medians. */
  one_off: number
  /** The same split of `income`: what counted recurring income brought, and the rest. */
  recurring_income: number
  one_off_income: number
}

export interface RealCashflowMonth extends RealCashflowTotals {
  period: string // YYYY-MM
  operation_count: number
  /** Suggested pairs and operations waiting on a flow question this month. */
  open_questions: number
  /** What those operations weigh. */
  open_amount: number
  /** Spent far more than the year's other months. */
  atypical: boolean
}

/** Where money went, or came from, read off the labels of one group. */
export interface RealCashflowCounterpart {
  group_key: string
  name: string
  amount: number
  operation_count: number
  /** Percent of what the listed direction weighs over the period. */
  share: number
}

/** An account whose stored operations leave part of the period out. */
export interface RealCashflowCoverageGap {
  account_id: string
  account_name: string
  first_day: string
  /** Its last sync when linked, its last operation when imported. */
  covered_until: string
  starts_late: boolean
  ends_early: boolean
}

export interface RealCashflowSafetyNet {
  available: number
  savings: number
  monthly_expenses: number
  months: number | null
  savings_months: number | null
  /** Balances no sync refreshed in the last week. */
  stale_accounts: string[]
}

export interface RealCashflowExpense {
  id: string
  operation_date: string | null
  label: string | null
  amount: number
  account_name: string
}

/** Response of GET /banking/real-cashflow — completed months only. */
export interface RealCashflowYear {
  year: number
  currency: string
  years_available: number[]
  months: RealCashflowMonth[]
  totals: RealCashflowTotals
  /** The months carrying data, which the mean and median are taken over. */
  covered_months: number
  open_questions: number
  open_amount: number
  monthly_mean: RealCashflowTotals
  monthly_median: RealCashflowTotals
  top_expenses: RealCashflowExpense[]
  top_sources: RealCashflowCounterpart[]
  top_destinations: RealCashflowCounterpart[]
  other_currencies: BankFlowCurrencyTotal[]
  /** The year before over the same months; null when it has none covered. */
  previous_year_to_date: RealCashflowTotals | null
  /** The current year only: its totals plus the median month for each month left. */
  projection: RealCashflowTotals | null
  safety_net: RealCashflowSafetyNet | null
  coverage_gaps: RealCashflowCoverageGap[]
  /** The current year only: what the active recurring payments cost a month, and the income brings. */
  running_recurring: number | null
  running_recurring_income: number | null
}

/** What one recurring payment, or income, weighed in a month. */
export interface RealCashflowRecurring {
  id: string | null
  key: string
  name: string
  nature: RecurringNature | null
  amount: number
  count: number
}

/** A due date of an active recurring payment, or income, still to come this month. */
export interface RealCashflowUpcoming {
  id: string | null
  key: string
  name: string
  date: string
  amount: number
}

/** Response of GET /banking/real-cashflow/months/{period}. */
export interface RealCashflowMonthDetail {
  period: string
  currency: string
  totals: RealCashflowTotals
  operation_count: number
  open_questions: number
  open_amount: number
  /** The nearest completed months carrying data, if any. */
  previous_period: string | null
  next_period: string | null
  other_currencies: BankFlowCurrencyTotal[]
  top_expenses: RealCashflowExpense[]
  top_sources: RealCashflowCounterpart[]
  top_destinations: RealCashflowCounterpart[]
  coverage_gaps: RealCashflowCoverageGap[]
  /** What each recurring payment weighed this month, and each recurring income brought. */
  recurring: RealCashflowRecurring[]
  recurring_income: RealCashflowRecurring[]
}

/** Response of GET /banking/real-cashflow/current — the month in progress, day by day. */
export interface RealCashflowCurrent {
  period: string
  currency: string
  day: number
  /** Pending card payments included. */
  spent_to_date: number
  pending_to_date: number
  /** Over the last twelve completed months with operations; null without any. */
  median_to_date: number | null
  median_month: number | null
  projection: number | null
  open_amount: number
  curve: Array<{ day: number; spent: number | null; median: number | null }>
  /** The due dates of active recurring payments still to come this month. */
  upcoming: RealCashflowUpcoming[]
  upcoming_amount: number
  /** The income still expected this month, apart: it moves no spending. */
  upcoming_income: RealCashflowUpcoming[]
  upcoming_income_amount: number
}

export type BankReviewKind = 'flow' | 'transfer' | 'recurring'

/** One question waiting for the user, on the operation carrying it. */
export interface BankReviewItem {
  kind: BankReviewKind
  transaction: BankTransactionItem
  /** What the answer can move; for a recurring payment or income, what it weighs a year. */
  amount: number
  operation_count: number
}

/** Response of GET /banking/review-queue — every open question, heaviest first. */
export interface BankReviewQueue {
  /** What the flow and transfer questions can still move: a recurring payment's answer moves no total. */
  total_amount: number
  total_count: number
  recurring_count: number
  /** Over the whole history, whatever the year asked for. */
  years: Array<{ year: number; amount: number; count: number }>
  questions: BankReviewItem[]
}

export interface BankLedgerAccount {
  id: string
  name: string
  type: string
  institution: string | null
  currency: string
  balance: number
  first_day: string | null
  covered_until: string | null
  linked: boolean
}

export interface BankLedgerGroup {
  key: string
  name: string
  is_credit: boolean
}

export interface BankLedgerRow {
  id: string
  /** Indexes into the ledger's accounts and groups. */
  account: number
  group: number
  /** YYYY-MM-DD */
  day: string | null
  amount: number
  currency: string
  is_credit: boolean
  is_pending: boolean
  label: string | null
  operation_type: OperationType
  cashflow_type: CashflowType
  type_source: TypeSource
  /** The rule typing it, so the type picker can take it back. */
  type_rule_id: string | null
  transfer_status: BankTransferStatus | null
  /** Whether the real cashflow counts it, and by how much in its type's direction. */
  counted: boolean
  signed: number
  question: BankReviewKind | null
  /** An answer still to come can change how it counts. */
  open: boolean
  /** Index into the ledger's `recurring`: a counted row of a counted recurring payment or income. */
  recurring: number | null
}

export interface BankLedgerRecurring {
  id: string | null
  key: string
  direction: RecurringDirection
  name: string
  cadence: RecurringCadence
}

/** Response of GET /banking/ledger — every stored operation, typed. */
export interface BankLedger {
  currency: string
  accounts: BankLedgerAccount[]
  groups: BankLedgerGroup[]
  rows: BankLedgerRow[]
  recurring: BankLedgerRecurring[]
}

/**
 * Response of GET /banking/transactions — one month of operations, with that
 * month's totals computed exactly as GET /banking/flows computes them.
 */
export interface BankTransactionsResponse {
  period: string // YYYY-MM
  currency: string
  inflow: number
  outflow: number
  net: number
  internal_transfers_excluded: number
  internal_transfers_amount: number
  /** Pairs offered to the user this month, still counted, and flow questions asked this month. */
  transfer_questions: number
  reversals_excluded: number
  reversals_amount: number
  pending_count: number
  pending_inflow: number
  pending_outflow: number
  other_currencies: BankFlowCurrencyTotal[]
  transactions: BankTransactionItem[]
}

export interface BankSyncResponse {
  synced: number
  results: BankAccountSyncResult[]
}

/** One account's outcome in an Enable Banking export import. */
export interface BankExportImportResult {
  bank_account_uuid: string
  status: ExportImportStatus
  inserted: number
  updated: number
  skipped: number
  /** Rows the bank sent without an amount, a direction or a status: dropped, never fatal. */
  malformed: number
  snapshots_written: number
  detail: string | null
}

export interface BankExportImportResponse {
  imported_accounts: number
  results: BankExportImportResult[]
}

export interface BankSessionLinkedAccount {
  bank_account_uuid: string
  name: string
  /** YYYY-MM-DD, or null when the account has never been synced. */
  last_synced_at: string | null
}

/**
 * One authorization granted to a bank. Retired consents stay in the list: their
 * account attachments survive expiry, so the status is what tells the user that
 * a reconnection is the only thing missing.
 */
export interface BankSessionSummary {
  uuid: string
  aspsp_name: string | null
  aspsp_country: string | null
  status: string
  status_message: string
  active: boolean
  consent_valid_until: string
  authorized_at: string
  accounts: BankSessionLinkedAccount[]
}

export interface BankAccountLinkRequest {
  identification_hash: string
  bank_account_uuid: string
}

export interface BankAccountLinkResult {
  bank_account_uuid: string
  identification_hash: string
  reconnected: boolean
}

// ─── Cashflow ────────────────────────────────────────────────

export type FlowType = 'INFLOW' | 'OUTFLOW'
export type Frequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface CashflowCreate {
  name: string
  flow_type: FlowType
  category: string
  amount: number
  frequency: Frequency
  transaction_date: string
  bank_account_id?: string
  is_active?: boolean
}

export interface CashflowUpdate {
  name?: string
  flow_type?: FlowType
  category?: string
  amount?: number
  frequency?: Frequency
  transaction_date?: string
  bank_account_id?: string
  is_active?: boolean
}

export interface CashflowResponse {
  id: string
  name: string
  flow_type: FlowType
  category: string
  amount: number
  frequency: Frequency
  transaction_date: string
  /** Normalized to monthly, in `currency`. */
  monthly_amount: number
  /**
   * The same figure in euros — what to aggregate on, since the app holds no
   * exchange rates. null when this flow's currency has no published rate.
   */
  monthly_amount_eur: number | null
  created_at: string
  updated_at: string
  bank_account_id: string | null
  /**
   * Read-only: the currency of the linked account, EUR when there is none.
   * A flow is denominated by the account it hits, so it is never submitted —
   * there is no field for it in CashflowCreate/Update.
   */
  currency: string
  /** false = excluded from the automatic bank balance sync */
  is_active: boolean
}

// Every total below is in euros, and null when a currency in play has no
// published rate — same contract as BankSummaryResponse.total_balance.
export interface CashflowCategoryResponse {
  category: string
  total_amount: number | null
  monthly_total: number | null
  count: number
  items: CashflowResponse[]
}

export interface CashflowSummaryResponse {
  flow_type: FlowType
  total_amount: number | null
  monthly_total: number | null
  categories: CashflowCategoryResponse[]
}

export interface CashflowBalanceResponse {
  total_inflows: number | null
  monthly_inflows: number | null
  total_outflows: number | null
  monthly_outflows: number | null
  net_balance: number | null
  monthly_balance: number | null
  savings_rate: number | null
  inflows: CashflowSummaryResponse
  outflows: CashflowSummaryResponse
}

// ─── Stocks ──────────────────────────────────────────────────

export type StockAccountType = 'PEA' | 'CTO' | 'PEA_PME'
export type StockTransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'DIVIDEND'

export interface StockAccountCreate {
  name: string
  account_type: StockAccountType
  institution_name?: string
  identifier?: string
  opened_at?: string | null
}

export interface StockAccountUpdate {
  name?: string
  institution_name?: string
  identifier?: string
  opened_at?: string | null
}

export interface StockAccountBasicResponse {
  id: string
  name: string
  account_type: StockAccountType
  institution_name: string | null
  identifier: string | null
  opened_at: string | null
  created_at: string
  updated_at: string
}

export interface StockTransactionCreate {
  account_id: string
  symbol: string
  asset_key?: string
  name?: string
  exchange?: string
  type: StockTransactionType
  amount: number
  price_per_unit: number
  fees?: number
  executed_at: string
  notes?: string
}

export interface StockTransactionBasicResponse {
  id: string
  account_id: string
  symbol: string
  name: string | null
  exchange: string | null
  type: StockTransactionType
  amount: number
  price_per_unit: number
  fees: number
  executed_at: string
  notes: string | null
}

export interface StockTransactionUpdate {
  symbol?: string
  asset_key?: string
  name?: string
  exchange?: string
  type?: StockTransactionType
  amount?: number
  price_per_unit?: number
  fees?: number
  executed_at?: string
  notes?: string
}

export interface AssetSearchResult {
  symbol: string
  asset_key?: string | null
  name: string | null
  exchange: string | null
  type: string | null
  currency: string | null
}

export interface AssetInfoResponse {
  symbol: string
  asset_key?: string | null
  name: string | null
  price: number | null
  currency: string | null
  exchange: string | null
  type: string | null
  change_percent: number | null
}

export interface CryptoHistoricalPriceResponse {
  symbol: string
  as_of: string
  price: number | null
  message: string | null
}

export interface StockTransactionBulkCreate {
  asset_key: string
  type: StockTransactionType
  amount: number
  price_per_unit: number
  fees?: number
  executed_at: string
  notes?: string
}

export interface StockBulkImportRequest {
  account_id: string
  transactions: StockTransactionBulkCreate[]
}

export interface StockBulkImportResponse {
  imported_count: number
  transactions: StockTransactionBasicResponse[]
}

export interface EurDepositCreate {
  amount: number
  fees: number
  executed_at: string
  notes?: string
}

// ─── Crypto ──────────────────────────────────────────────────

export type CryptoAtomicTransactionType =
  | 'BUY'
  | 'SPEND'
  | 'FEE'
  | 'REWARD'
  | 'DEPOSIT'
  | 'ANCHOR'
  | 'TRANSFER'
  | 'WITHDRAW'

export type CryptoCompositeTransactionType =
  | 'BUY'
  | 'REWARD'
  | 'FIAT_DEPOSIT'
  | 'CRYPTO_DEPOSIT'
  | 'TRANSFER'
  | 'FIAT_WITHDRAW'
  | 'SELL_TO_FIAT'
  | 'FEE'
  | 'EXIT'

// Kept as public alias for existing imports across the app.
export type CryptoTransactionType = CryptoAtomicTransactionType

export interface CryptoAccountCreate {
  name: string
  platform?: string
  public_address?: string
  opened_at?: string | null
}

export interface CryptoAccountUpdate {
  name?: string
  platform?: string
  public_address?: string
  opened_at?: string | null
}

export interface CryptoAccountBasicResponse {
  id: string
  name: string
  platform: string | null
  public_address: string | null
  opened_at: string | null
  created_at: string
  updated_at: string
}

export interface CryptoTransactionCreate {
  account_id: string
  asset_key: string
  name?: string
  type: CryptoAtomicTransactionType
  amount: number
  price_per_unit: number
  executed_at: string
  notes?: string
  tx_hash?: string
}

export interface CryptoTransactionBasicResponse {
  id: string
  account_id: string
  group_uuid: string | null
  asset_key: string
  type: CryptoAtomicTransactionType
  amount: number
  price_per_unit: number
  executed_at: string
  notes: string | null
  tx_hash: string | null
}

/** Wrapper returned by POST /transactions/composite and cross-account-transfer. */
export interface CryptoCompositeTransactionResponse {
  rows: CryptoTransactionBasicResponse[]
  warning: string | null
  info: string | null
}

export interface CryptoTransactionUpdate {
  asset_key?: string
  name?: string
  type?: CryptoAtomicTransactionType
  amount?: number
  price_per_unit?: number
  executed_at?: string
  notes?: string
  tx_hash?: string
}

export interface CryptoTransactionBulkCreate {
  asset_key: string
  type: CryptoAtomicTransactionType
  amount: number
  price_per_unit: number
  executed_at: string
  notes?: string
  tx_hash?: string
  group_uuid?: string | null
}

export interface CryptoCompositeTransactionCreate {
  account_id: string
  /** Action type — maps to 1-3 atomic rows in the backend. */
  type: CryptoCompositeTransactionType
  asset_key: string
  name?: string
  amount: number
  price_per_unit?: number
  quote_asset_key?: string
  quote_amount?: number
  quote_price_per_unit?: number
  eur_amount?: number
  fee_included: boolean
  fee_percentage?: number
  fee_eur?: number
  fee_asset_key?: string
  fee_amount?: number
  executed_at: string
  tx_hash?: string
  notes?: string
}

export interface CrossAccountTransferCreate {
  from_account_id: string
  to_account_id: string
  asset_key: string
  name?: string | null
  amount: number
  fee_asset_key?: string | null
  fee_amount?: number | null
  executed_at: string
  tx_hash?: string | null
  notes?: string | null
}

export interface CryptoBulkImportRequest {
  account_id: string
  transactions: CryptoTransactionBulkCreate[]
}

export interface CryptoBulkImportResponse {
  imported_count: number
  transactions: CryptoTransactionBasicResponse[]
}

/** One composite operation row for the generic CSV import (one line = one trade). */
export interface CryptoCompositeBulkItem {
  type: CryptoCompositeTransactionType
  asset_key: string
  name?: string
  amount: number
  eur_amount?: number
  quote_asset_key?: string
  quote_amount?: number
  fee_included?: boolean
  fee_asset_key?: string
  fee_amount?: number
  executed_at: string
  tx_hash?: string
  notes?: string
}

export interface CryptoBulkCompositeImportRequest {
  account_id: string
  transactions: CryptoCompositeBulkItem[]
}

export interface CryptoBulkCompositeImportResponse {
  /** Total number of atomic rows created in the database. */
  imported_count: number
  /** Number of composite operations (CSV lines) processed. */
  groups_count: number
}

// ─── Binance Import ──────────────────────────────────────────

export interface BinanceImportRowPreview {
  operation: string
  coin: string
  change: number
  mapped_type: string
  mapped_asset_key: string
  mapped_amount: number
  mapped_price: number
}

export interface BinanceImportGroupPreview {
  group_index: number
  timestamp: string
  rows: BinanceImportRowPreview[]
  summary: string
  has_eur: boolean
  auto_eur_amount: number | null
  needs_eur_input: boolean
  hint_usdc_amount: number | null
  eur_amount: number | null
  /** Set by the unified /imports crypto preview when the group is already imported. */
  is_duplicate?: boolean
}

export interface BinanceImportPreviewRequest {
  csv_content: string
}

export interface BinanceImportPreviewResponse {
  total_groups: number
  total_rows: number
  groups_needing_eur: number
  groups: BinanceImportGroupPreview[]
}

export interface BinanceImportConfirmRequest {
  account_id: string
  groups: BinanceImportGroupPreview[]
}

export interface BinanceImportConfirmResponse {
  imported_count: number
  groups_count: number
}

// ─── Unified Imports (multi-platform) ────────────────────────

export type ImportCategory = 'crypto' | 'stock' | 'bank'

export interface ImportSourceInfo {
  source_id: string
  label: string
  category: ImportCategory
  file_hint: string
  supports_mapping: boolean
  /** Columns the parser assumes when nothing is mapped: a file already
   *  carrying them skips the mapping step entirely. */
  default_mapping: Record<string, string> | null
  /** Downloadable CSV skeleton, when the source documents one. */
  template_csv: string | null
  /** Bank sources: whether the file may land on a bank-linked account, on the
   *  days before the bank's own history. */
  fills_before_bank_history: boolean
}

export interface ImportSourcesResponse {
  sources: ImportSourceInfo[]
}

export interface DetectMatch {
  source_id: string
  score: number
}

export interface DetectResponse {
  matches: DetectMatch[]
}

/** CSV column names → target fields (for generic parsers with mapping). */
export interface ColumnMapping {
  date?: string
  type?: string
  asset?: string
  quantity?: string
  price?: string
  fees?: string
  /** Bank: end-of-day balance column (mode "balance"). */
  balance?: string
  /** Bank: signed movement column (mode "delta"). */
  amount?: string
}

export interface ImportOptions {
  mapping?: ColumnMapping
  delimiter?: string
  decimal_separator?: string
  date_format?: string
  type_mapping?: Record<string, string>
  /** Bank: "balance" (each row is a balance) or "delta" (each row is a movement). */
  /** Bank delta mode: starting balance before the first movement. */
  initial_balance?: number | string
}

export interface ImportPreviewRequest {
  csv_content: string
  account_id?: string
  options?: ImportOptions
}

export interface StockImportRowPreview {
  row_index: number
  executed_at: string
  type: string
  asset_key: string | null
  isin: string | null
  name: string | null
  amount: number
  price_per_unit: number
  fees: number
  needs_asset_key: boolean
  is_duplicate: boolean
  error: string | null
  notes: string | null
}

export interface BankImportPointPreview {
  snapshot_date: string
  value: number
  is_duplicate: boolean
}

/** One movement read from a statement CSV. `amount` is the magnitude: the
 *  sign in the file has already been read into `direction`. */
export interface BankImportTransactionPreview {
  day: string
  amount: number
  direction: 'CRDT' | 'DBIT'
  label: string
  currency: string
  is_duplicate: boolean
}

/** The balance curve a movements file describes, once anchored. */
export interface BankImportCurvePreview {
  start_date: string
  end_date: string
  /** Balance held before the first movement — what the whole curve hangs on. */
  opening_balance: number
  closing_balance: number
  days: number
  /** Set when the curve dips below zero: usually an anchor left too low. */
  first_negative_date: string | null
}

/** Common preview envelope: exactly one category payload is set. */
export interface ImportPreviewResponse {
  source_id: string
  category: ImportCategory
  total_rows: number
  duplicates_count: number
  error_rows: number
  warnings: string[]
  crypto: BinanceImportPreviewResponse | null
  stock_rows: StockImportRowPreview[] | null
  bank_points: BankImportPointPreview[] | null
  bank_transactions: BankImportTransactionPreview[] | null
  bank_curve: BankImportCurvePreview | null
  /** Bank-linked account only (YYYY-MM-DD): the first day the bank's own history
   *  covers. The file is imported up to the day before. */
  bank_history_from: string | null
  /** Rows the bank already holds, left out of `bank_transactions`. */
  covered_by_bank_count: number
}

export interface ImportConfirmRequest {
  account_id: string
  skip_duplicates?: boolean
  options?: ImportOptions
  crypto_groups?: BinanceImportGroupPreview[] | null
  stock_rows?: StockImportRowPreview[] | null
  bank_points?: BankImportPointPreview[] | null
  bank_transactions?: BankImportTransactionPreview[] | null
  overwrite?: boolean
}

export interface ImportConfirmResponse {
  imported_count: number
  skipped_duplicates: number
  groups_count: number | null
  covered_by_bank_count: number
}

// ─── Notes ───────────────────────────────────────────────────

export interface NoteCreate {
  name: string
  description?: string
}

export interface NoteUpdate {
  name?: string
  description?: string
}

export interface NoteResponse {
  id: string
  name: string
  description: string | null
  position: number
  created_at: string
  updated_at: string
}

// ─── Shared / Portfolio ──────────────────────────────────────

export interface TransactionResponse {
  id: string
  name: string | null
  symbol: string
  asset_key: string
  exchange: string | null
  type: string
  amount: number
  price_per_unit: number
  fees: number
  executed_at: string
  notes: string | null
  currency: string
  total_cost: number
  fees_percentage: number
  group_uuid: string | null
  current_price: number | null
  current_value: number | null
  profit_loss: number | null
  profit_loss_percentage: number | null
}

export interface PositionResponse {
  symbol: string
  name: string | null
  asset_key: string
  exchange: string | null
  total_amount: number
  average_buy_price: number
  total_invested: number
  total_fees: number
  fees_percentage: number
  currency: string
  current_price: number | null
  current_value: number | null
  profit_loss: number | null
  profit_loss_percentage: number | null
}

export interface AccountSummaryResponse {
  account_id: string
  account_name: string
  account_type: string
  total_invested: number
  total_deposits: number
  total_withdrawals: number
  total_fees: number
  currency: string
  total_dividends: number
  current_value: number | null
  cash_balance: number
  profit_loss: number | null
  profit_loss_percentage: number | null
  realized_profit_loss: number | null
  total_profit_loss: number | null
  positions: PositionResponse[]
}

export interface PortfolioResponse {
  total_invested: number
  total_fees: number
  current_value: number | null
  profit_loss: number | null
  profit_loss_percentage: number | null
  accounts: AccountSummaryResponse[]
}

// ── Settings ─────────────────────────────────────────────

// --- AI types ---

export interface AIProviderConfig {
  provider: string
  has_key: boolean
  selected_model: string | null
}

export interface AIProviderUpdate {
  api_key?: string | null
  selected_model?: string | null
}

export interface AIProviderOption {
  provider: string
  label: string
  has_key: boolean
}

/** A model the user's key can reach, as the provider lists it. */
export interface AIModelOption {
  id: string
  label: string
  /** Reads images, so it can serve the photo import */
  vision: boolean
}

export interface AIModelsResponse {
  models: AIModelOption[]
  /** What "automatic" (selected_model = null) calls */
  recommended: string | null
}

export interface AIOptionsResponse {
  capabilities: {
    vision: AIProviderOption[]
    chat: AIProviderOption[]
  }
}

// --- Settings DTOs ---

export interface UserSettingsUpdate {
  objectives?: string | null
  theme?: string
  /** IANA timezone for date display. null = follow the browser. */
  display_timezone?: string | null
  /** BCP 47 locale for date/number formatting. null = app default (fr-FR). */
  display_locale?: string | null
  flat_tax_rate?: number
  tax_pea_rate?: number
  yield_expectation?: number
  inflation_rate?: number
  crypto_module_enabled?: boolean
  crypto_mode?: 'SINGLE' | 'MULTI'
  crypto_show_negative_positions?: boolean
  bank_module_enabled?: boolean
  bank_auto_sync_enabled?: boolean
  cashflow_module_enabled?: boolean
  wealth_module_enabled?: boolean
  ai_feature_enabled?: boolean
  open_banking_enabled?: boolean
  ai_vision_provider?: string | null
  ai_chat_provider?: string | null
  /** USD→EUR rate override. null/undefined = use auto-fetched live rate. */
  usd_eur_rate?: number | null
  /** Reference index for the analytics. Empty string resets to the default. */
  benchmark_asset_key?: string | null
  /** Target plan for the analytics. An empty object clears the stored one. */
  investment_plan?: Record<string, unknown> | null
  /** /analyse blocks to hide. An empty array shows everything again. */
  analysis_hidden_sections?: string[]
}

export interface UserSettingsResponse {
  objectives: string | null
  theme: string
  /** IANA timezone for date display. null = follow the browser. */
  display_timezone: string | null
  /** BCP 47 locale for date/number formatting. null = app default (fr-FR). */
  display_locale: string | null
  flat_tax_rate: number
  tax_pea_rate: number
  yield_expectation: number
  inflation_rate: number
  crypto_module_enabled: boolean
  crypto_mode: 'SINGLE' | 'MULTI'
  crypto_show_negative_positions: boolean
  bank_module_enabled: boolean
  bank_auto_sync_enabled: boolean
  cashflow_module_enabled: boolean
  wealth_module_enabled: boolean
  ai_feature_enabled: boolean
  open_banking_enabled: boolean
  ai_vision_provider: string | null
  ai_chat_provider: string | null
  ai_providers: AIProviderConfig[]
  /** null = live rate is used automatically */
  usd_eur_rate: number | null
  /** null = the default MSCI World ETF is used */
  benchmark_asset_key: string | null
  /** null = no target plan declared */
  investment_plan: Record<string, unknown> | null
  /** Blocks hidden on /analyse. Empty = everything is shown. */
  analysis_hidden_sections: string[]
  created_at: string
  updated_at: string
}

// ─── Assets (Personal Possessions) ──────────────────────────

export interface AssetCreate {
  name: string
  description?: string | null
  category: string
  purchase_price?: number | null
  estimated_value?: number | null
  currency?: string
  acquisition_date?: string | null
}

export interface AssetUpdate {
  name?: string
  description?: string | null
  category?: string
  purchase_price?: number | null
  estimated_value?: number
  currency?: string
  acquisition_date?: string | null
}

export interface AssetSell {
  sold_price: number
  sold_at: string
}

export interface AssetResponse {
  id: string
  name: string
  description: string | null
  category: string
  purchase_price: number | null
  estimated_value: number
  currency: string
  acquisition_date: string | null
  profit_loss: number | null
  sold_price: number | null
  sold_at: string | null
  last_valuation_date: string | null
  created_at: string
  updated_at: string
}

export interface AssetValuationCreate {
  estimated_value: number
  note?: string | null
  valued_at: string
}

export interface AssetValuationUpdate {
  estimated_value?: number
  note?: string | null
  valued_at?: string
}

export interface AssetValuationResponse {
  id: string
  asset_id: string
  estimated_value: number
  note: string | null
  valued_at: string
  created_at: string
}

export interface AssetCategorySummary {
  category: string
  count: number
  total_estimated_value: number
}

export interface AssetSummaryResponse {
  total_estimated_value: number
  total_purchase_price: number
  total_profit_loss: number | null
  asset_count: number
  categories: AssetCategorySummary[]
  assets: AssetResponse[]
}

// ─── Placements (AV, PER, SCPI…) ────────────────────────────

export type PlacementType =
  | 'AV'
  | 'PER'
  | 'EPARGNE_SALARIALE'
  | 'SCPI'
  | 'CROWDFUNDING'
  | 'CAPITALISATION'
  | 'OTHER'
export type PlacementEntryType = 'VALUATION' | 'DEPOSIT' | 'WITHDRAW'

export interface PlacementAccountCreate {
  name: string
  placement_type: PlacementType
  institution_name?: string | null
  opened_at?: string | null
  expected_return_rate?: number | null
}

export type PlacementAccountUpdate = Partial<PlacementAccountCreate>

export interface PlacementAccountResponse {
  id: string
  name: string
  placement_type: PlacementType
  institution_name: string | null
  opened_at: string | null
  expected_return_rate: number | null
  current_value: number
  total_deposits: number
  total_withdrawals: number
  net_invested: number
  gain: number | null
  gain_percentage: number | null
  last_valuation_date: string | null
  last_valuation_value: number | null
  days_since_valuation: number | null
  is_stale: boolean
  annual_return_rate: number | null
  return_days: number
  tax_anniversary_date: string | null
  created_at: string
  updated_at: string
}

export interface PlacementSummaryResponse {
  total_value: number
  total_deposits: number
  total_withdrawals: number
  net_invested: number
  accounts: PlacementAccountResponse[]
}

export interface PlacementEntryCreate {
  type: PlacementEntryType
  amount: number
  occurred_at: string
  note?: string | null
}

export interface PlacementEntryUpdate {
  amount?: number
  occurred_at?: string
  note?: string | null
}

export interface PlacementEntryResponse {
  id: string
  account_id: string
  type: PlacementEntryType
  amount: number
  occurred_at: string
  note: string | null
  created_at: string
  updated_at: string
}

// ─── Dashboard Statistics ────────────────────────────────────

export interface InvestmentDistribution {
  stock_invested: number
  stock_current_value: number | null
  stock_percentage: number | null
  crypto_invested: number
  crypto_current_value: number | null
  crypto_percentage: number | null
  placements_invested: number
  placements_current_value: number
  placements_percentage: number | null
  total_deposits: number
  total_withdrawals: number
}

export interface WealthBreakdown {
  cash: number
  cash_percentage: number | null
  investments: number
  investments_percentage: number | null
  assets: number
  assets_percentage: number | null
  total_deposits: number
  total_withdrawals: number
  total_wealth: number
}

export interface DashboardStatisticsResponse {
  distribution: InvestmentDistribution
  wealth: WealthBreakdown
}

// ─── Projection ─────────────────────────────────────────────

export type ProjectionCategory = 'BANK' | 'STOCK' | 'CRYPTO' | 'PLACEMENT'

export interface ProjectionAssetParameters {
  monthly_injection?: number | null
  return_rate?: number | null
}

export interface ProjectionParameters {
  months_to_project: number
  assets?: Partial<Record<ProjectionCategory, ProjectionAssetParameters>>
}

export interface ProjectionBasisWarning {
  code: string
  values: Record<string, number>
}

/** How a default was measured — absent on responses from before it was exposed. */
export interface ProjectionAssetBasis {
  contribution: string
  contribution_months: number
  contribution_total: number
  return: string
  return_days: number
  warnings: ProjectionBasisWarning[]
}

export interface ProjectionAssetParametersUsed {
  monthly_injection: number
  return_rate: number
  basis?: ProjectionAssetBasis | null
}

export interface ProjectionDataPoint {
  date: string
  asset_values: Partial<Record<ProjectionCategory, number>>
  total_value: number
}

export interface ProjectionResponse {
  parameters_used: {
    months_to_project: number
    assets: Record<ProjectionCategory, ProjectionAssetParametersUsed>
  }
  data: ProjectionDataPoint[]
}

// ─── Community ───────────────────────────────────────────────

export interface CommunitySettingsUpdate {
  is_active: boolean
  is_private: boolean
  display_name?: string | null
  bio?: string | null
  shared_stock_asset_keys: string[]
  shared_crypto_asset_keys: string[]
}

export interface CommunitySettingsResponse {
  is_active: boolean
  is_private: boolean
  display_name: string | null
  bio: string | null
  shared_stock_asset_keys: string[]
  shared_crypto_asset_keys: string[]
  positions_count: number
}

export interface CommunityPositionResponse {
  asset_key: string
  name: string | null
  asset_type: 'CRYPTO' | 'STOCK'
  pnl_percentage: number | null
  /** Average entry price. Never reveals the quantity held. */
  pru: number | null
  first_bought_at: string | null
}

export interface CommunityProfileResponse {
  username: string
  display_name: string | null
  bio: string | null
  is_private: boolean
  is_following: boolean
  is_followed_by: boolean
  is_mutual: boolean
  positions: CommunityPositionResponse[]
  global_pnl_percentage: number | null
  followers_count: number
  following_count: number
  picks: PickResponse[]
  created_at: string | null
}

export interface CommunityProfileListItem {
  username: string
  display_name: string | null
  bio: string | null
  is_private: boolean
  is_following: boolean
  is_followed_by: boolean
  is_mutual: boolean
}

export interface CommunitySearchResult {
  username: string
  display_name: string | null
  bio: string | null
  is_private: boolean
  is_following: boolean
  is_followed_by: boolean
  is_mutual: boolean
}

export interface FollowResponse {
  is_following: boolean
  is_mutual: boolean
}

export interface AvailablePosition {
  asset_key: string
  asset_type: 'CRYPTO' | 'STOCK'
  name?: string | null
}

export interface AvailablePositionsResponse {
  stocks: AvailablePosition[]
  crypto: AvailablePosition[]
}

// ── Picks (likes) ──────────────────────────────────────────────

export interface PickCreate {
  asset_key: string
  asset_type: 'CRYPTO' | 'STOCK'
  comment?: string | null
  target_price?: number | null
}

export interface PickUpdate {
  comment?: string | null
  target_price?: number | null
}

export interface PickResponse {
  id: number
  username: string
  asset_key: string
  name?: string | null
  asset_type: 'CRYPTO' | 'STOCK'
  comment: string | null
  target_price: number | null
  created_at: string
  updated_at: string
  price_at_pick: number | null
  current_price: number | null
  performance_pct: number | null
  /** null = no target was set, which is not the same as a missed target. */
  target_reached: boolean | null
}

// ─── Dashboard History ────────────────────────────────────────

export interface GlobalHistorySnapshotResponse {
  snapshot_date: string
  total_wealth: number
  stock_value: number
  crypto_value: number
  bank_value: number
  assets_value: number
  placements_value: number
}

export interface AssetHistorySnapshotResponse {
  snapshot_date: string
  total_value: number
  total_invested: number
  daily_pnl: number | null
}

export interface AccountHistorySnapshotResponse {
  snapshot_date: string
  total_value: number
  total_invested: number
  total_deposits: number
  total_withdrawals: number
  daily_pnl: number | null
  cumulative_pnl: number | null
  total_fees: number | null
  total_dividends: number | null
  positions?: {
    asset_key: string
    quantity: number
    value: number
    price: number | null
    invested: number
    percentage: number
  }[] | null
}

// ── Analytics ────────────────────────────────────────────────
/** `estimé` = extrapolated from a partial ledger: a figure, not a reading. */
export type Reliability = 'solide' | 'indicatif' | 'estimé' | 'insuffisant'

export interface MetricOut {
  value: number | string | null
  unit: string
  sample_size: number
  reliability: Reliability
  caveat: string | null
}

export type Tone = 'good' | 'watch' | 'bad'

/** How a reading's value and ceilings are printed. */
export type ReadingFormat = 'pct' | 'days' | 'decimal' | 'bps' | 'times'

export interface BandOut {
  /** Inclusive ceiling; null on the last band, which runs to infinity. */
  up_to: number | string | null
  label: string
  tone: Tone
}

/** Where a block's headline figure sits on the API's own scale. */
export interface ReadingOut {
  value: number | string | null
  format: ReadingFormat
  active: number | null
  tone: Tone | null
  bands: BandOut[]
}

export interface SignalOut {
  block: string
  label: string
  tone: Tone | 'neutral'
  value: number | string | null
  format: ReadingFormat | null
  /** Signed from the reader's side: negative is money lost. */
  eur: number | string | null
}

export interface InvestorGapResponse {
  twr: MetricOut
  twr_annualised: MetricOut
  benchmark_annualised: MetricOut
  mwr: MetricOut
  gap: MetricOut
  gap_eur: MetricOut
  average_capital: number | string
  auto_provision_share: number | string
  verdict: string
}

export interface BridgeStepOut {
  key: string
  label: string
  amount: number | string
}

export interface CounterfactualResponse {
  baseline: number | string
  steps: BridgeStepOut[]
  residual: number | string
  final: number | string
  behaviour_cost: number | string
  idle_cash: number | string
  idle_cash_opportunity: number | string | null
  covered_from: string
  covered_days: number
  /** Valuation day — yesterday's close, since today's does not exist yet. */
  valued_at: string
  truncated: boolean
  order: string[]
  verdict: string
}

export interface SlippageDistributionOut {
  minimum: number | string
  q1: number | string
  median: number | string
  q3: number | string
  maximum: number | string
}

export interface ExecutionResponse {
  slippage_bps: MetricOut
  cost_eur: MetricOut
  order_count: number
  distribution: SlippageDistributionOut | null
  p_value: number | string | null
  percentile: number | string | null
  is_detectable: boolean
  verdict: string
}

export interface MonthlyAmountOut {
  year: number
  month: number
  amount: number | string
}

export interface RegularityResponse {
  monthly: MonthlyAmountOut[]
  months_total: number
  months_invested: number
  purchase_count: number
  /** Distance to a straight-line deployment. This is what judges regularity. */
  deployment_gap: MetricOut
  /** Descriptive, never declared: "achats autour du 6 du mois". */
  cadence_label: string
  median_gap_days: number | null
  invested_share: MetricOut
  variation_coefficient: MetricOut
  longest_gap_months: MetricOut
  temporal_hhi: MetricOut
  equivalent_monthly_purchases: MetricOut
  day_of_month_spread: MetricOut
  median_day_of_month: number | null
  reading?: ReadingOut | null
  verdict: string
}

export interface DepositLagResponse {
  median_days: MetricOut
  q1_days: MetricOut
  q3_days: MetricOut
  p90_days: MetricOut
  matched_eur: number | string
  unmatched_eur: number | string
  unmatched_share: number | string
  never_invested_eur: number | string
  unpaired_deposits_eur: number | string
  deposit_variation: MetricOut
  purchase_variation: MetricOut
  idle_cash_opportunity: number | string | null
  reading?: ReadingOut | null
  verdict: string
}

export interface DensityBinOut {
  centre: number | string
  purchase_share: number | string
  session_share: number | string
}

export interface MarketPointOut {
  day: string
  amount: number | string
  drawdown: number | string
}

export interface YearlyDrawdownOut {
  label: string
  drawdown: number | string
}

export interface MarketConditioningResponse {
  weighted_drawdown: MetricOut
  unconditional_drawdown: MetricOut
  weighted_momentum: MetricOut
  unconditional_momentum: MetricOut
  density: DensityBinOut[]
  points: MarketPointOut[]
  yearly: YearlyDrawdownOut[]
  p_value: number | string | null
  percentile: number | string | null
  is_detectable: boolean
  sessions: number
  verdict: string
}

export interface TurnoverOut {
  annual_rate: MetricOut
  purchases_eur: number | string
  sales_eur: number | string
}

/** An ISIN identifies a line; the symbol and name are what a reader can use. */
export interface AssetLabelOut {
  asset_key: string
  symbol: string
  name: string
}

export interface WeightOut extends AssetLabelOut {
  weight: number | string
}

/**
 * A line the user has traded, offered as a choice rather than typed.
 * Served by /analytics/assets, separately from the analysis itself: a dropdown
 * must not wait behind a full replay, nor need enough history to compute one.
 */
export interface AnalysedAsset extends AssetLabelOut {
  /** Still in the portfolio, as opposed to fully sold. */
  held: boolean
  invested_eur: number | string
  first_bought: string
  last_activity: string
}

export interface CorrelationOut {
  left: string
  right: string
  value: number | string
  left_symbol: string
  right_symbol: string
  left_name: string
  right_name: string
}

export interface ConcentrationResponse {
  lines: number
  effective_positions: MetricOut
  independent_bets: MetricOut
  weights: WeightOut[]
  correlations: CorrelationOut[]
  max_correlation: number | string | null
  overlap: number
  dropped: AssetLabelOut[]
  reading?: ReadingOut | null
  verdict: string
}

export interface FeesResponse {
  total_fees: MetricOut
  fee_share: MetricOut
  annual_bps: MetricOut
  threshold_order_size: MetricOut
  orders_below_threshold: number
  /** Whether grouping orders is worth recommending, not merely possible. */
  avoidable: boolean
  /**
   * How the broker appears to charge, read off the orders rather than assumed.
   * Under `proportionnel` order size is irrelevant and grouping changes nothing.
   * Same-size orders fit both models exactly and come back `indéterminé`.
   */
  model: 'fixe' | 'proportionnel' | 'indéterminé'
  /** Fees over notional on the charged orders — what a percentage tariff is. */
  fee_rate: number | string | null
  cost_below_threshold: number | string
  invested_below_threshold: number | string
  /** What the broker takes on a charged order. Free orders are not averaged in. */
  average_fee: number | string | null
  average_order: number | string | null
  order_count: number
  /** Orders carrying a recorded fee — the real sample size of every figure here. */
  orders_with_fee: number
  /** orders_with_fee / order_count. */
  fee_coverage: number | string
  /** What was actually keyed in. Equals total_fees on a complete ledger. */
  recorded_fees: number | string
  /** Whether the totals were extrapolated over the orders with nothing recorded. */
  is_estimated: boolean
  projection_eur: number | string | null
  projection_note: string
  ter_note: string
  reading?: ReadingOut | null
  verdict: string
}

export interface EpisodeOut {
  asset_key: string
  opened: string
  closed: string
  profit: number | string
}

export interface ExitsResponse {
  pgr: MetricOut
  plr: MetricOut
  ratio: MetricOut
  cost_eur: MetricOut
  realisations: number
  recent_sales: number
  measured_sales: number
  horizon_days: number
  hit_rate: MetricOut
  payoff_ratio: MetricOut
  episode_count: number
  episodes: EpisodeOut[]
  reading?: ReadingOut | null
  verdict: string
}

export interface MonthlyAdherenceOut {
  year: number
  month: number
  target: number | string
  invested: number | string
}

export interface AllocationDriftOut extends AssetLabelOut {
  target: number | string
  actual: number | string
}

export interface PlanFlowOut extends AssetLabelOut {
  target: number | string
  actual: number | string
}

export interface PlanPeriodOut {
  since: string
  /** Start of the next period, or null while this one is still running. */
  until: string | null
  monthly_target: number | string
  allocation: Record<string, number | string>
  /** Complete months scored inside this period. */
  months: number
  target_eur: number | string
  invested_eur: number | string
  adherence_ratio: number | string | null
  /**
   * Distance between the euros this period actually put in, split by line, and
   * the split it declared. Distinct from the plan-level drift, which reads the
   * portfolio held today and so says nothing about a period that has ended.
   */
  flow_drift_l1: number | string | null
  flows: PlanFlowOut[]
}

export interface PlanResponse {
  /** The target in force today, when the plan is split into periods. */
  monthly_target: number | string
  periods: PlanPeriodOut[]
  since: string
  months: MonthlyAdherenceOut[]
  total_target: number | string
  total_invested: number | string
  adherence_ratio: MetricOut
  average_monthly: MetricOut
  drift: AllocationDriftOut[]
  drift_l1: MetricOut
  rebalance_eur: number | string | null
  under_invested_months: number
  under_in_down_months: number
  reading?: ReadingOut | null
  verdict: string
  error: string | null
}

export interface InvestmentPlanPeriodInput {
  since: string
  monthly_target: string
  allocation: Record<string, string>
}

/**
 * A plan that never changed is stored flat; one that did carries its periods.
 * The shape says which it is, so no mode has to be persisted alongside it.
 */
export interface InvestmentPlanInput {
  monthly_target?: string
  allocation?: Record<string, string>
  since?: string
  periods?: InvestmentPlanPeriodInput[]
}

export interface InvestorAnalyticsResponse {
  period_start: string | null
  period_end: string | null
  days: number
  benchmark_asset_key: string
  verdict: string
  signals: SignalOut[]
  investor_gap: InvestorGapResponse | null
  counterfactual: CounterfactualResponse | null
  execution: ExecutionResponse | null
  regularity: RegularityResponse | null
  turnover: TurnoverOut | null
  deposit_lag: DepositLagResponse | null
  market_conditioning: MarketConditioningResponse | null
  concentration: ConcentrationResponse | null
  fees: FeesResponse | null
  exits: ExitsResponse | null
  plan: PlanResponse | null
}

// ─── Community activity & notifications ───────────────────────

export interface ActivityItem {
  type: 'pick' | 'target_reached'
  username: string
  display_name: string | null
  asset_key: string
  asset_type: 'CRYPTO' | 'STOCK'
  comment: string | null
  target_price: number | null
  performance_pct: number | null
  occurred_at: string
}

export interface NotificationResponse {
  id: number
  type: 'new_follower' | 'mutual_follow' | 'pick_target_reached'
  message: string
  actor_username: string | null
  asset_key: string | null
  read_at: string | null
  created_at: string
}

export interface NotificationListResponse {
  unread_count: number
  notifications: NotificationResponse[]
}

/** One daily close of an asset, in EUR. */
export interface AssetPricePoint {
  date: string
  price: number
}

/** One of the user's own trades, positioned on the asset's price curve. */
export interface AssetTimelineEvent {
  date: string
  /** BUY, SELL or INCOME — a dividend or staking reward. */
  type: 'BUY' | 'SELL' | 'INCOME'
  quantity: number
  /**
   * Where the marker sits on the price axis: the executed unit price for a
   * BUY/SELL, the close of the day for INCOME (which has no price of its own).
   */
  price: number | null
  /** Signed cash impact in EUR — negative when money went out. */
  total: number
  cost_basis_after: number | null
}

/** An asset's price history since the user first bought it, with their trades. */
export interface AssetPriceTimelineResponse {
  asset_key: string
  symbol: string | null
  name: string | null
  asset_type: string | null
  currency: string
  points: AssetPricePoint[]
  events: AssetTimelineEvent[]
  /** Unit cost basis in EUR, fees included. Null once fully sold. */
  average_buy_price: number | null
  quantity_held: number
  current_price: number | null
}
