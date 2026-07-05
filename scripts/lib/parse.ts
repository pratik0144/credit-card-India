/*
 * PURE parsing helpers for the §7.1 structured import pass.
 *
 * Every function here is deterministic and side-effect-free so the parsing
 * logic can be unit-tested and dry-run-verified without a database (BACKEND
 * §15.2). scripts/import-cards.ts wires these into the actual upserts.
 *
 * Canonical taxonomy keys are imported from src/lib/taxonomy.ts so the messy
 * free-text `card_category` maps onto the exact CONTENT_CATEGORIES slugs and
 * we never invent new keys.
 */
import {
  CONTENT_CATEGORIES,
  type ContentCategorySlug,
  type CardNetwork,
  type RewardType,
  type DataConfidence,
} from '../../src/lib/taxonomy';

/* ------------------------------------------------------------------ */
/* (est) detection                                                     */
/* ------------------------------------------------------------------ */

/** True if the raw source value carries an `(est)` / "(estimated)" marker. */
export function hasEstMarker(raw: unknown): boolean {
  if (raw == null) return false;
  return /\(est\)|\(estimated\)/i.test(String(raw));
}

/** Strip `(est)` / "(estimated)" markers and collapse the resulting whitespace. */
export function stripEst(raw: unknown): string {
  if (raw == null) return '';
  return String(raw)
    .replace(/\(estimated\)/gi, '')
    .replace(/\(est\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* Blank / not-applicable detection                                    */
/* ------------------------------------------------------------------ */

const NA_RE = /^(n\/?a|not applicable|not available|nil|none|-|—|tbd)$/i;

export function isBlank(raw: unknown): boolean {
  if (raw == null) return true;
  const s = stripEst(raw).trim();
  return s === '' || NA_RE.test(s);
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/**
 * Parse an Indian money string into a numeric rupee value.
 *   "Rs. 2500" -> 2500 | "₹3,00,000" -> 300000 | "Rs. 0" -> 0
 *   "Rs. 999 (Verify on official site)" -> 999 | "Nil" -> 0
 * Handles the Lakh shorthand ("₹7.5 Lakhs" -> 750000, "2 Lakh" -> 200000)
 * and Crore ("1 Crore" -> 10000000). Returns null when no number is present.
 */
export function parseMoney(raw: unknown): number | null {
  if (raw == null) return null;
  const s = stripEst(raw);
  if (s === '') return null;
  // Explicit zero-ish phrasings.
  if (/^(nil|zero|free|lifetime\s*free|no\s*(joining|annual)?\s*fee)/i.test(s)) return 0;

  const lakh = /(\d[\d,]*\.?\d*)\s*(lakh|lac|lakhs)/i.exec(s);
  if (lakh) return Math.round(parseFloat(lakh[1].replace(/,/g, '')) * 100000);
  const crore = /(\d[\d,]*\.?\d*)\s*(crore|cr)\b/i.exec(s);
  if (crore) return Math.round(parseFloat(crore[1].replace(/,/g, '')) * 10000000);

  // First bare number (Indian grouping uses commas we simply drop).
  const m = /(\d[\d,]*\.?\d*)/.exec(s);
  if (!m) {
    // "Rs. 0" already handled by number regex; a stray "Free" etc handled above.
    if (/\b0\b/.test(s)) return 0;
    return null;
  }
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Percentage                                                          */
/* ------------------------------------------------------------------ */

/** "3.5%" -> 3.5 | "Nil" / "0% (waived)" -> 0 | "2% (est)" -> 2 */
export function parsePercent(raw: unknown): number | null {
  if (raw == null) return null;
  const s = stripEst(raw);
  if (s === '') return null;
  if (/^(nil|zero|no\s+markup|waived)/i.test(s) && !/\d/.test(s)) return 0;
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(s);
  if (m) return parseFloat(m[1]);
  // "0% (forex markup waived)" — matched above; bare "0" fallback:
  if (/^0\b/.test(s)) return 0;
  return null;
}

/* ------------------------------------------------------------------ */
/* Age range                                                           */
/* ------------------------------------------------------------------ */

export interface AgeRange {
  age_min: number | null;
  age_max: number | null;
}

/**
 * "21 - 65 years" -> {21,65}. Handles the many verbose salaried/self-employed
 * variants by taking the smallest min and largest max integer that look like
 * plausible ages (18..80) appearing in the string.
 */
export function parseAgeRange(raw: unknown): AgeRange {
  if (raw == null) return { age_min: null, age_max: null };
  const s = stripEst(raw);
  if (s === '') return { age_min: null, age_max: null };
  const nums = (s.match(/\d{2}/g) || [])
    .map((n) => parseInt(n, 10))
    .filter((n) => n >= 18 && n <= 80);
  if (nums.length === 0) return { age_min: null, age_max: null };
  if (nums.length === 1) return { age_min: nums[0], age_max: null };
  return { age_min: Math.min(...nums), age_max: Math.max(...nums) };
}

/* ------------------------------------------------------------------ */
/* Editorial score  "7.5/10" -> {raw, score5}                          */
/* ------------------------------------------------------------------ */

export interface EditorialScore {
  editorial_score_raw: string | null;
  editorial_score_5: number | null;
}

export function parseEditorialScore(raw: unknown): EditorialScore {
  if (raw == null) return { editorial_score_raw: null, editorial_score_5: null };
  const s = String(raw).trim();
  if (s === '') return { editorial_score_raw: null, editorial_score_5: null };
  const m = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/.exec(s);
  if (!m) return { editorial_score_raw: s, editorial_score_5: null };
  const num = parseFloat(m[1]);
  const den = parseFloat(m[2]);
  if (!den) return { editorial_score_raw: s, editorial_score_5: null };
  const score5 = Math.round((num / den) * 5 * 10) / 10; // one decimal, matches numeric(2,1)
  return { editorial_score_raw: s, editorial_score_5: score5 };
}

/* ------------------------------------------------------------------ */
/* CIBIL  "750+ (est)" -> {750, estimated}                             */
/* ------------------------------------------------------------------ */

export interface CibilParsed {
  cibil_min: number | null;
  cibil_min_is_estimated: boolean;
}

export function parseCibil(raw: unknown): CibilParsed {
  const estimated = hasEstMarker(raw);
  if (raw == null) return { cibil_min: null, cibil_min_is_estimated: estimated };
  const s = stripEst(raw);
  // Secured / no-CIBIL products have no numeric floor.
  if (/no\s+(cibil|credit|minimum)|not\s+required|fd-?backed|secured/i.test(s)) {
    return { cibil_min: null, cibil_min_is_estimated: estimated };
  }
  const m = /(\d{3})/.exec(s);
  return {
    cibil_min: m ? parseInt(m[1], 10) : null,
    cibil_min_is_estimated: estimated,
  };
}

/* ------------------------------------------------------------------ */
/* Network + estimated flag                                            */
/* ------------------------------------------------------------------ */

export interface NetworkParsed {
  network: CardNetwork | null;
  network_is_estimated: boolean;
}

/**
 * "Visa (est)" -> {visa, true}. Multi-network strings ("Visa / Mastercard")
 * keep the FIRST recognized network (the primary listing network); suffixes
 * like "Visa Infinite" / "Mastercard World Elite" collapse to the base network.
 */
export function parseNetwork(raw: unknown): NetworkParsed {
  const estimated = hasEstMarker(raw);
  if (raw == null) return { network: null, network_is_estimated: estimated };
  const s = stripEst(raw).toLowerCase();
  const order: [RegExp, CardNetwork][] = [
    [/\bvisa\b/, 'visa'],
    [/master\s*card|mastercard/, 'mastercard'],
    [/\brupay\b/, 'rupay'],
    [/\bamex\b|american express/, 'amex'],
    [/diners/, 'diners'],
  ];
  // Preserve source ordering: pick whichever recognized network appears first.
  let best: { idx: number; net: CardNetwork } | null = null;
  for (const [re, net] of order) {
    const m = re.exec(s);
    if (m && (best === null || m.index < best.idx)) best = { idx: m.index, net };
  }
  return { network: best ? best.net : null, network_is_estimated: estimated };
}

/* ------------------------------------------------------------------ */
/* Reward type normalization                                           */
/* ------------------------------------------------------------------ */

/**
 * Collapse the many free-text reward-type labels (CashPoints, NeuCoins,
 * InterMiles, "Points/Cashback", "Miles (Edge Miles)"…) to the canonical enum.
 * Multiple distinct types -> 'hybrid'.
 */
export function parseRewardType(raw: unknown): RewardType | null {
  if (raw == null) return null;
  const s = stripEst(raw).toLowerCase();
  if (s === '') return null;
  const hasCashback = /cashback|cash\s*back|cashpoint/.test(s);
  const hasMiles = /\bmiles?\b|intermiles|maharaja/.test(s);
  // "points" but not the cashpoints token we already counted as cashback.
  const hasPoints = /point|neucoin|reward/.test(s) && !/cashpoint/.test(s.replace(/cashback/g, ''));
  const kinds = [hasCashback, hasMiles, hasPoints].filter(Boolean).length;
  if (kinds >= 2) return 'hybrid';
  if (hasMiles) return 'miles';
  if (hasCashback) return 'cashback';
  if (hasPoints) return 'points';
  return null;
}

/* ------------------------------------------------------------------ */
/* Contactless / UPI                                                   */
/* ------------------------------------------------------------------ */

export interface ContactlessParsed {
  supports_contactless: boolean | null;
  supports_upi: boolean | null;
}

export function parseContactlessUpi(raw: unknown): ContactlessParsed {
  if (raw == null) return { supports_contactless: null, supports_upi: null };
  const s = stripEst(raw).toLowerCase();
  if (s === '') return { supports_contactless: null, supports_upi: null };
  const affirmative = /\byes\b|true|contactless|supported/.test(s);
  const contactless = /contactless/.test(s) ? true : affirmative ? true : false;
  const upi = /upi/.test(s);
  return { supports_contactless: contactless, supports_upi: upi };
}

/* ------------------------------------------------------------------ */
/* Fuel surcharge waiver %                                             */
/* ------------------------------------------------------------------ */

/** Extract the surcharge waiver percentage, e.g. "1% fuel surcharge waiver" -> 1. */
export function parseFuelSurchargePct(raw: unknown): number | null {
  if (raw == null) return null;
  const s = stripEst(raw);
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(s);
  return m ? parseFloat(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Lounge access                                                       */
/* ------------------------------------------------------------------ */

export interface LoungeParsed {
  visits_per_year: number | null;
  network: string | null; // e.g. "Priority Pass" (intl only)
}

/**
 * Normalize lounge visit text to an annual count.
 *  "4 complimentary visits per calendar year" -> 4
 *  "2 per quarter" -> 8   |  "2 per quarter (up to 8 per year)" -> 8
 *  "Unlimited" -> 99 (sentinel high value)
 *  "Not Applicable" -> 0
 * Also extracts an intl lounge network (Priority Pass / DreamFolks / Diners).
 */
export function parseLounge(raw: unknown): LoungeParsed {
  if (raw == null) return { visits_per_year: null, network: null };
  const s = stripEst(raw);
  const netMatch = /(priority pass|dreamfolks|diners|loungekey)/i.exec(s);
  const network = netMatch ? titleCaseKnown(netMatch[1]) : null;
  if (isBlank(s)) return { visits_per_year: 0, network };
  if (/unlimited/i.test(s)) return { visits_per_year: 99, network };

  // Prefer an explicit "per year"/"annually"/"per calendar year" number.
  const perYear = /(\d+)\s*(?:complimentary\s*)?(?:visits?|access|lounge)?[^.]*?(?:per\s*(?:calendar\s*)?year|annually|per\s*annum|per\s*year)/i.exec(s);
  if (perYear) return { visits_per_year: parseInt(perYear[1], 10), network };

  // "up to N per year" explicit annual cap.
  const upto = /up\s*to\s*(\d+)\s*per\s*(?:calendar\s*)?year/i.exec(s);
  if (upto) return { visits_per_year: parseInt(upto[1], 10), network };

  // Per-quarter / per-month → annualize.
  const perQ = /(\d+)\s*(?:visits?|access)?[^.]*?per\s*(?:calendar\s*)?quarter/i.exec(s);
  if (perQ) return { visits_per_year: parseInt(perQ[1], 10) * 4, network };
  const perM = /(\d+)\s*(?:visits?|access)?[^.]*?per\s*month/i.exec(s);
  if (perM) return { visits_per_year: parseInt(perM[1], 10) * 12, network };

  // Bare leading integer ("12", "8 per year, 2 per quarter").
  const bare = /^(\d+)\b/.exec(s.trim());
  if (bare) return { visits_per_year: parseInt(bare[1], 10), network };

  // Any first integer as a last resort.
  const any = /(\d+)/.exec(s);
  return { visits_per_year: any ? parseInt(any[1], 10) : null, network };
}

function titleCaseKnown(m: string): string {
  const l = m.toLowerCase();
  if (l === 'priority pass') return 'Priority Pass';
  if (l === 'dreamfolks') return 'DreamFolks';
  if (l === 'diners') return 'Diners';
  if (l === 'loungekey') return 'LoungeKey';
  return m;
}

/* ------------------------------------------------------------------ */
/* Employment type + minimum income → card_eligibility rows            */
/* ------------------------------------------------------------------ */

export type EligEmployment = 'salaried' | 'self_employed' | 'student' | 'any';

export interface EligibilityRow {
  employment_type: EligEmployment;
  min_income_amount: number | null;
  min_income_period: 'monthly' | 'annual' | null;
  raw_text: string;
}

/**
 * Derive one or more card_eligibility rows from the messy `employment_type`
 * + `minimum_income` fields. We emit a row per detected employment type and
 * attach whichever income figure clearly belongs to it (salaried→monthly,
 * self-employed→ITR/annual) when the source separates them; otherwise the same
 * figure is shared. Falls back to a single 'any' row when nothing parses.
 */
export function parseEligibility(
  employmentRaw: unknown,
  incomeRaw: unknown,
): EligibilityRow[] {
  const empS = stripEst(employmentRaw);
  const incS = stripEst(incomeRaw);
  const rawText = [employmentRaw, incomeRaw].filter(Boolean).map(String).join(' | ');

  const types = new Set<EligEmployment>();
  if (/salaried/i.test(empS)) types.add('salaried');
  if (/self[-\s]?employed|business|professional|doctor/i.test(empS)) types.add('self_employed');
  if (/student/i.test(empS)) types.add('student');
  if (types.size === 0) types.add('any');

  // Split income into salaried (monthly) vs self-employed (annual/ITR) segments.
  const income = splitIncome(incS);

  const rows: EligibilityRow[] = [];
  for (const t of types) {
    let amount: number | null = null;
    let period: 'monthly' | 'annual' | null = null;
    if (t === 'salaried' && income.salaried) {
      amount = income.salaried.amount;
      period = income.salaried.period;
    } else if (t === 'self_employed' && income.selfEmployed) {
      amount = income.selfEmployed.amount;
      period = income.selfEmployed.period;
    } else if (income.fallback) {
      amount = income.fallback.amount;
      period = income.fallback.period;
    }
    rows.push({
      employment_type: t,
      min_income_amount: amount,
      min_income_period: period,
      raw_text: rawText || empS || incS,
    });
  }
  return rows;
}

interface IncomeBit {
  amount: number;
  period: 'monthly' | 'annual';
}
interface IncomeSplit {
  salaried?: IncomeBit;
  selfEmployed?: IncomeBit;
  fallback?: IncomeBit;
}

/** Best-effort split of a minimum-income string into salaried/self-employed bits. */
export function splitIncome(incS: string): IncomeSplit {
  if (!incS || isBlank(incS)) return {};
  const out: IncomeSplit = {};

  // Salaried segment.
  const salSeg = /salaried[^,;]*?(₹|rs\.?|\d)[^,;()]*/i.exec(incS);
  if (salSeg) {
    const bit = incomeBit(salSeg[0]);
    if (bit) out.salaried = bit;
  }
  // Self-employed / ITR segment.
  const seSeg = /(self[-\s]?employed|itr)[^,;]*?(₹|rs\.?|\d)[^,;()]*/i.exec(incS);
  if (seSeg) {
    const bit = incomeBit(seSeg[0]);
    if (bit) out.selfEmployed = bit;
  }
  // Fallback: a plain number with no salaried/self-employed labelling.
  if (!out.salaried && !out.selfEmployed) {
    const bit = incomeBit(incS);
    if (bit) out.fallback = bit;
  }
  return out;
}

/** Parse a single income phrase to an amount + period. Handles Lakh + per-month/annum. */
export function incomeBit(seg: string): IncomeBit | null {
  const s = stripEst(seg);
  const isAnnual = /per\s*annum|per\s*year|p\.?a\.?|itr|annual/i.test(s);
  const isMonthly = /per\s*month|monthly|p\.?m\.?/i.exec(s);

  // Range "₹60,000 - ₹1,00,000" → take the lower bound (the floor for eligibility).
  const nums: number[] = [];
  const lakhRe = /(\d[\d,]*\.?\d*)\s*(lakh|lac|lakhs)/gi;
  let lm: RegExpExecArray | null;
  let sReduced = s;
  while ((lm = lakhRe.exec(s)) !== null) {
    nums.push(Math.round(parseFloat(lm[1].replace(/,/g, '')) * 100000));
  }
  if (nums.length === 0) {
    sReduced = s.replace(/\bper\b|\bmonth\b|\byear\b|\bannum\b/gi, ' ');
    const plain = sReduced.match(/(\d[\d,]*\.?\d*)/g) || [];
    for (const p of plain) {
      const v = parseFloat(p.replace(/,/g, ''));
      if (Number.isFinite(v) && v >= 1000) nums.push(v);
    }
  }
  if (nums.length === 0) return null;
  const amount = Math.min(...nums);
  const period: 'monthly' | 'annual' = isAnnual && !isMonthly ? 'annual' : 'monthly';
  return { amount, period };
}

/* ------------------------------------------------------------------ */
/* Slug derivation                                                     */
/* ------------------------------------------------------------------ */

export function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Card slug = bank-slug + card-name-slug, e.g. hdfc-bank-all-miles-credit-card. */
export function deriveCardSlug(bankName: string, cardName: string): string {
  const bankSlug = slugify(bankName);
  const cardSlug = slugify(cardName);
  // Avoid doubling the bank prefix if the card name already starts with it.
  if (cardSlug.startsWith(bankSlug + '-')) return cardSlug;
  return `${bankSlug}-${cardSlug}`;
}

/* ------------------------------------------------------------------ */
/* Content-category mapping (messy card_category -> CONTENT_CATEGORIES) */
/* ------------------------------------------------------------------ */

const CONTENT_SLUGS = new Set<string>(CONTENT_CATEGORIES.map((c) => c.slug));

/**
 * Map the free-text `card_category` (+ tier + reward_type hints) to one or more
 * canonical CONTENT_CATEGORIES slugs. Returns { slugs, isDiscontinued }.
 * A card can belong to more than one content category; the first slug is
 * treated as primary by the caller.
 */
export function mapContentCategories(
  cardCategoryRaw: unknown,
  opts: { tier?: string; rewardType?: string; annualFee?: number | null } = {},
): { slugs: ContentCategorySlug[]; isDiscontinued: boolean } {
  const raw = String(cardCategoryRaw ?? '').toLowerCase();
  const isDiscontinued = /discontinued/i.test(raw);
  const slugs = new Set<ContentCategorySlug>();

  const add = (s: string) => {
    if (CONTENT_SLUGS.has(s)) slugs.add(s as ContentCategorySlug);
  };

  if (/cashback|cash back/.test(raw)) add('cashback');
  if (/travel|miles|airline|air india|vistara/.test(raw)) add('travel');
  if (/reward/.test(raw)) add('rewards');
  if (/fuel|petrol|diesel/.test(raw)) add('fuel');
  if (/business|corporate|commercial/.test(raw)) add('business');
  if (/student/.test(raw)) add('student');
  if (/dining|food|restaurant/.test(raw)) add('dining');
  if (/shopping|online shopping|e-?commerce|lifestyle|retail/.test(raw)) add('shopping');
  if (/lounge/.test(raw)) add('airport-lounge');
  if (/low interest|low-interest/.test(raw)) add('low-interest');

  const tier = String(opts.tier ?? '').toLowerCase();
  if (/super\s*premium|infinite|world elite|reserve|diners black|signature/.test(tier + ' ' + raw)) {
    add('super-premium');
  }

  // Lifetime free: derive from a genuinely zero annual fee.
  if (opts.annualFee === 0 || /lifetime free|ltf/.test(raw + ' ' + tier)) add('lifetime-free');

  // Reward-type fallbacks when the category text was unhelpful.
  if (slugs.size === 0) {
    const rt = String(opts.rewardType ?? '').toLowerCase();
    if (/cashback/.test(rt)) add('cashback');
    else if (/mile/.test(rt)) add('travel');
    else add('rewards'); // safe generic default
  }

  return { slugs: [...slugs], isDiscontinued };
}

/* ------------------------------------------------------------------ */
/* data_confidence + estimated_fields                                  */
/* ------------------------------------------------------------------ */

/**
 * Map raw source keys → the canonical `cards` column names used in
 * estimated_fields. Only fields that can carry an (est) marker are listed.
 */
export const EST_FIELD_MAP: Record<string, string> = {
  card_network: 'network',
  'variant/tier': 'tier',
  joining_fee: 'joining_fee_amount',
  annual_fee: 'annual_fee_amount',
  annual_fee_waiver_spend: 'annual_fee_waiver_spend_amount',
  forex_markup: 'forex_markup_pct',
  reward_rate_general: 'reward_rate_general_text',
  reward_rate_category_wise: 'reward_rate_category_wise',
  all_bonus: 'all_bonus',
  fuel_surcharge_waiver: 'fuel_surcharge_waiver_text',
  airport_lounge_domestic: 'lounge_domestic_visits_per_year',
  airport_lounge_international: 'lounge_intl_visits_per_year',
  'all_offers [highlights]': 'all_offers',
  minimum_income: 'min_income_amount',
  employment_type: 'employment_type',
  cibil_min: 'cibil_min',
};

export interface ConfidenceResult {
  estimated_fields: string[];
  data_confidence: DataConfidence;
}

/**
 * Walk the source record, collect canonical field names carrying (est), and
 * derive data_confidence: verified (none est), estimated (most/all populated
 * fields est), else partially_estimated.
 */
export function deriveConfidence(record: Record<string, unknown>): ConfidenceResult {
  const estimated_fields: string[] = [];
  let populated = 0;
  let estimatedCount = 0;

  for (const [srcKey, canonical] of Object.entries(EST_FIELD_MAP)) {
    const v = record[srcKey];
    if (v == null || String(v).trim() === '') continue;
    populated += 1;
    if (hasEstMarker(v)) {
      estimated_fields.push(canonical);
      estimatedCount += 1;
    }
  }

  let data_confidence: DataConfidence;
  if (estimatedCount === 0) data_confidence = 'verified';
  else if (populated > 0 && estimatedCount / populated >= 0.6) data_confidence = 'estimated';
  else data_confidence = 'partially_estimated';

  return { estimated_fields, data_confidence };
}

/* ------------------------------------------------------------------ */
/* base_reward_value_inr_per_100 (rough general-rate normalization)    */
/* ------------------------------------------------------------------ */

/**
 * A COARSE ₹-value-per-₹100 estimate at the general rate, parsed from the raw
 * text alone (no point_valuations join). This is a placeholder used only for
 * the dry-run report and as a fallback; the authoritative value is recomputed
 * in the LLM enrichment pass (§7.2) using point_valuations. Returns null when
 * the general rate can't be read.
 *
 *  "3.5%" -> 3.5
 *  "5 Reward Points for every ₹150 spent" -> points/₹150*100 * assumedInrPerPt
 *  "3X Reward Points for every ₹150 spent" -> uses 3 as base points/₹150
 */
export function estimateBaseRewardPer100(
  rewardGeneralRaw: unknown,
  assumedInrPerPoint = 0.25,
): number | null {
  if (rewardGeneralRaw == null) return null;
  const s = stripEst(rewardGeneralRaw);
  if (s === '') return null;

  // Direct cashback percentage.
  const pct = /(\d+(?:\.\d+)?)\s*%/.exec(s);
  if (pct) return parseFloat(pct[1]);

  // "N points/RP for every ₹X" or "NX ... for every ₹X".
  const perSpend = /(\d+(?:\.\d+)?)\s*x?\s*(?:reward\s*)?(?:points?|rp|cashpoints?|neucoins?|miles?|intermiles?)?[^₹]*?(?:for\s*every|per|on)\s*₹?\s*(\d[\d,]*)/i.exec(s);
  if (perSpend) {
    const units = parseFloat(perSpend[1]);
    const per = parseFloat(perSpend[2].replace(/,/g, ''));
    if (per > 0) {
      // For an "NX" multiplier the base is usually N points per the stated spend.
      const inrValue = (units / per) * 100 * assumedInrPerPoint;
      return Math.round(inrValue * 100) / 100;
    }
  }
  return null;
}

/* ================================================================== */
/* Deterministic enrichment (replaces the LLM pass).                   */
/* Parses the free-text reward/bonus/offer prose straight from the     */
/* source JSON into structured rows — no external API.                 */
/* ================================================================== */

type SpendKey =
  | 'general' | 'groceries' | 'online_shopping' | 'dining' | 'travel_flights'
  | 'travel_hotels' | 'fuel' | 'utility_bills' | 'emi_large_purchases'
  | 'entertainment' | 'other';

/**
 * Merchant/keyword → canonical spend-category. Order matters: more specific
 * phrases first. Used to bucket a reward clause into a category_key. Returns the
 * first matching key, or null if nothing recognizable (caller may skip or use
 * 'general').
 */
const CATEGORY_KEYWORDS: [RegExp, SpendKey][] = [
  [/hotel|resort|stay|booking\.com|makemytrip|goibibo|oyo/i, 'travel_hotels'],
  [/flight|air\s?india|vistara|indigo|airline|air\s?ticket|airfare|travel booking|air miles|emirates|spicejet/i, 'travel_flights'],
  [/travel|trip|holiday|vacation|smartbuy travel/i, 'travel_flights'],
  [/grocer|supermarket|bigbasket|blinkit|dmart|jiomart|zepto|kirana/i, 'groceries'],
  [/dining|dine|restaurant|swiggy|zomato|food delivery|eazydiner|eating out/i, 'dining'],
  [/fuel|petrol|diesel|hpcl|bpcl|iocl|indian oil|jio-?bp|gas station/i, 'fuel'],
  [/utilit|electricity|bill payment|mobile recharge|recharge|broadband|dth|water bill|gas bill|insurance premium/i, 'utility_bills'],
  [/movie|entertainment|bookmyshow|pvr|inox|ott|netflix|prime video|hotstar|spotify|gaming/i, 'entertainment'],
  [/emi|large purchase|electronics|appliance|instal?ment/i, 'emi_large_purchases'],
  [/amazon|flipkart|myntra|ajio|nykaa|online shopping|e-?commerce|shopping online|paytm mall|tata\s?neu|tata cliq|reliance digital/i, 'online_shopping'],
  [/shopping|retail|apparel|department store|lifestyle store/i, 'online_shopping'],
  [/all (other )?spends?|every spend|across spends|other retail|general/i, 'general'],
];

function keywordToCategory(text: string): SpendKey | null {
  for (const [re, key] of CATEGORY_KEYWORDS) if (re.test(text)) return key;
  return null;
}

/** All distinct spend categories mentioned in a clause (e.g. "hotel, recharge and shopping"). */
function keywordToCategoriesAll(text: string): SpendKey[] {
  const found: SpendKey[] = [];
  for (const [re, key] of CATEGORY_KEYWORDS) if (re.test(text) && !found.includes(key)) found.push(key);
  return found;
}

export interface RewardCategoryRow {
  category_key: SpendKey;
  multiplier: number | null;
  rate_pct: number | null;
  cap_amount: number | null;
  cap_period: 'monthly' | 'billing_cycle' | 'yearly' | null;
  raw_text: string;
}

/** Parse a cap phrase like "capped Rs. 500/month" / "up to Rs. 1,000 per statement cycle". */
function parseCap(text: string): { cap_amount: number | null; cap_period: RewardCategoryRow['cap_period'] } {
  const amt = /(?:capp?ed|up\s*to|max(?:imum)?)[^₹Rs\d]*(?:₹|rs\.?\s*)?(\d[\d,]*)/i.exec(text);
  const cap_amount = amt ? parseInt(amt[1].replace(/,/g, ''), 10) : null;
  let cap_period: RewardCategoryRow['cap_period'] = null;
  if (/month/i.test(text)) cap_period = 'monthly';
  else if (/statement|billing\s*cycle|cycle/i.test(text)) cap_period = 'billing_cycle';
  else if (/year|annual|annum/i.test(text)) cap_period = 'yearly';
  return { cap_amount, cap_period };
}

/**
 * Extract structured reward-category rows from a card's category-wise text +
 * general rate + reward type. Splits on ';' / ',' / ' and ' clause boundaries,
 * buckets each clause by keyword, and reads its multiplier ("5X") or rate ("10%").
 * Always emits a `general` row from the general rate so every card has a baseline.
 * PURE — deterministic, no network.
 */
export function parseRewardCategories(
  categoryWiseRaw: unknown,
  generalRaw: unknown,
  rewardType: RewardType | null,
): RewardCategoryRow[] {
  const rows: RewardCategoryRow[] = [];
  const seen = new Set<string>();
  const isCashback = rewardType === 'cashback';

  const pushRow = (r: RewardCategoryRow) => {
    if (seen.has(r.category_key)) return; // keep the first (richest, since clauses are ordered)
    seen.add(r.category_key);
    rows.push(r);
  };

  // General baseline row from the general rate.
  const gs = stripEst(generalRaw);
  if (gs) {
    const gMult = /(\d+(?:\.\d+)?)\s*x\b/i.exec(gs);
    const gPctM = /(\d+(?:\.\d+)?)\s*%/.exec(gs);
    const gDiscount = /\boff\b|discount|waiver|savings?/i.test(gs);
    let gRate: number | null = null;
    if (gPctM && !gDiscount) { const v = parseFloat(gPctM[1]); if (v <= 20) gRate = v; }
    pushRow({
      category_key: 'general',
      multiplier: !isCashback && gMult ? parseFloat(gMult[1]) : null,
      rate_pct: gRate,
      cap_amount: null, cap_period: null,
      raw_text: gs.slice(0, 300),
    });
  }

  const processClause = (clause: string) => {
    const cats = keywordToCategoriesAll(clause);
    if (cats.length === 0) return;
    const mult = /(\d+(?:\.\d+)?)\s*x\b/i.exec(clause);
    const pctM = /(\d+(?:\.\d+)?)\s*%/.exec(clause);
    // "X% off / discount" is a DISCOUNT, not an earn rate — only accept a % when
    // the clause is clearly about earning and the rate is sane (≤20%).
    const isDiscount = /\boff\b|discount|savings?|waiver/i.test(clause);
    const rewardCtx = isCashback || /cashback|cash\s*back|reward|points?|earn|\brp\b|neucoin/i.test(clause);
    let rate_pct: number | null = null;
    if (pctM && !isDiscount && rewardCtx) { const v = parseFloat(pctM[1]); if (v <= 20) rate_pct = v; }
    const multiplier = !isCashback && mult ? parseFloat(mult[1]) : null;
    if (multiplier == null && rate_pct == null) return; // no valid earn rate
    const cap = parseCap(clause);
    for (const key of cats) {
      pushRow({ category_key: key, multiplier, rate_pct, cap_amount: cap.cap_amount, cap_period: cap.cap_period, raw_text: clause.slice(0, 300) });
    }
  };

  const cw = stripEst(categoryWiseRaw);
  if (cw) {
    // Commas do double duty — clause separators ("10% on X, 5% on Y") AND
    // category-list separators within ONE rate ("hotel, recharge and shopping: 2X").
    // Split on ';'/newline first; only sub-split a segment on commas when it
    // carries MORE THAN ONE rate token (otherwise commas list shared categories).
    for (const seg of cw.split(/;|\n|\.(?=\s+[A-Z])/).map((s) => s.trim()).filter(Boolean)) {
      const rateCount = (seg.match(/\d+(?:\.\d+)?\s*(?:x\b|%)/gi) || []).length;
      const subs = rateCount > 1 ? seg.split(/,(?=\s*[A-Za-z])/) : [seg];
      for (const sub of subs) processClause(sub);
    }
  }
  return rows;
}

export interface BonusRow {
  bonus_type: 'welcome' | 'milestone' | 'anniversary' | 'other';
  description: string;
  threshold_spend_amount: number | null;
  estimated_value_inr: number | null;
  is_estimated: boolean;
  raw_text: string;
}

/** All rupee amounts in a string, lakh/crore-aware, in appearance order. */
function moneyTokens(text: string): number[] {
  const out: number[] = [];
  const re = /(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)\s*(lakh|lac|lakhs|crore|cr|k)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ''));
    const unit = (m[2] || '').toLowerCase();
    if (/lakh|lac/.test(unit)) n *= 100000;
    else if (/crore|cr/.test(unit)) n *= 10000000;
    else if (unit === 'k') n *= 1000;
    // Ignore bare small integers with no ₹/unit (likely "2X", counts, years).
    if (unit || /₹|rs/i.test(m[0]) || n >= 500) out.push(Math.round(n));
  }
  return out;
}

/** Extract welcome/milestone/anniversary bonuses from the all_bonus prose. */
export function parseBonuses(allBonusRaw: unknown): BonusRow[] {
  const raw = String(allBonusRaw ?? '');
  const clean = stripEst(raw);
  if (!clean) return [];
  const isEst = hasEstMarker(raw);
  const rows: BonusRow[] = [];
  // Split into clauses on ';', newline, or comma-before-letter. Commas inside
  // "₹1,00,000" (comma before a digit) are preserved.
  for (const clause of clean.split(/;|\n|,(?=\s*[A-Za-z])/).map((c) => c.trim()).filter((c) => c.length > 3)) {
    let bonus_type: BonusRow['bonus_type'] = 'other';
    if (/welcome|joining|activation|sign-?up/i.test(clause)) bonus_type = 'welcome';
    else if (/milestone|spend.*(threshold|target)|on (?:spending|achieving)/i.test(clause)) bonus_type = 'milestone';
    else if (/anniversary|renewal|yearly/i.test(clause)) bonus_type = 'anniversary';
    else if (!/bonus|benefit|voucher|points|reward|cashback|miles/i.test(clause)) continue;

    const amounts = moneyTokens(clause);
    // Milestone/anniversary: the spend threshold is typically the largest amount.
    const threshold = (bonus_type === 'milestone' || bonus_type === 'anniversary') && amounts.length
      ? Math.max(...amounts) : null;
    // Welcome value: the amount tied to "worth/value/equivalent", else the first.
    const valMatch = /(?:worth|value|equivalent|of)\s*(?:₹|rs\.?\s*)(\d[\d,]*)/i.exec(clause);
    const estimated_value_inr = valMatch ? parseInt(valMatch[1].replace(/,/g, ''), 10)
      : (bonus_type === 'welcome' && amounts.length ? amounts[0] : null);

    rows.push({
      bonus_type, description: clause.slice(0, 300),
      threshold_spend_amount: threshold, estimated_value_inr,
      is_estimated: isEst, raw_text: clause.slice(0, 300),
    });
  }
  return rows;
}

export interface OfferRow { offer_text: string; category: string | null; is_estimated: boolean; }

/** Extract discrete offers from the all_offers/highlights prose. */
export function parseOffers(allOffersRaw: unknown): OfferRow[] {
  const raw = String(allOffersRaw ?? '');
  const clean = stripEst(raw);
  if (!clean) return [];
  const isEst = hasEstMarker(raw);
  return clean.split(/[;]|,(?=\s*[A-Z0-9])/).map((c) => c.trim()).filter((c) => c.length > 4)
    .map((offer_text) => {
      const cat = keywordToCategory(offer_text);
      return { offer_text: offer_text.slice(0, 300), category: cat, is_estimated: isEst };
    }).slice(0, 12);
}
