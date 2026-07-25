/*
 * Adaptive question tree for the recommendation wizard.
 *
 * The wizard always asks exactly 10 questions, but they are NOT the same 10 for
 * everyone. Eight are fixed anchors (goal, spend, categories + per-category
 * amounts, age, employment, income, CIBIL); the last two branch on the answers
 * so far — a traveller is asked about flights and forex, a first-timer about
 * credit history, everyone else about flights + fee appetite. Numeric questions
 * accept digits only (no free text). See orderedQuestions() for the tree.
 */
import type { SpendCategoryKey } from './taxonomy';
import { SPEND_CATEGORY_LABELS } from './taxonomy';
import type { RecommendAnswers } from './recommend-engine';

export type InputKind = 'single' | 'multi' | 'number' | 'number_group';

export interface Option { value: string; label: string }

export interface NumberField { key: string; label: string }

export interface Question {
  id: string;
  kind: InputKind;
  title: string;
  help?: string;
  /** single / multi */
  options?: Option[];
  max?: number;
  /** number */
  min?: number;
  maxValue?: number;
  unit?: string;
  placeholder?: string;
  step?: number;
  /** number_group: numeric fields, derived from a prior multi answer. */
  fields?: NumberField[];
}

/** Raw answer store, keyed by question id. */
export type AnswerMap = Record<string, string | string[] | number | Record<string, number>>;

export const TOTAL_QUESTIONS = 10;

/* ---- category options offered for the "where do you spend" step ---- */
const CATEGORY_OPTIONS: { value: SpendCategoryKey; label: string }[] = [
  { value: 'online_shopping', label: SPEND_CATEGORY_LABELS.online_shopping },
  { value: 'groceries', label: SPEND_CATEGORY_LABELS.groceries },
  { value: 'dining', label: SPEND_CATEGORY_LABELS.dining },
  { value: 'fuel', label: SPEND_CATEGORY_LABELS.fuel },
  { value: 'utility_bills', label: SPEND_CATEGORY_LABELS.utility_bills },
  { value: 'travel_flights', label: SPEND_CATEGORY_LABELS.travel_flights },
  { value: 'entertainment', label: SPEND_CATEGORY_LABELS.entertainment },
  { value: 'emi_large_purchases', label: SPEND_CATEGORY_LABELS.emi_large_purchases },
];

/* ---- fixed anchor questions ---- */
const Q_GOAL: Question = {
  id: 'goal',
  kind: 'single',
  title: 'What do you mainly want from a credit card?',
  help: 'This shapes the rest of your questions.',
  options: [
    { value: 'cashback', label: 'Cashback' },
    { value: 'rewards_points', label: 'Reward points' },
    { value: 'travel_miles', label: 'Travel & miles' },
    { value: 'lounge_access', label: 'Airport lounge access' },
    { value: 'fuel_savings', label: 'Fuel savings' },
    { value: 'first_card', label: 'My first credit card' },
    { value: 'business', label: 'Business expenses' },
  ],
};

const Q_MONTHLY_SPEND: Question = {
  id: 'monthly_spend',
  kind: 'number',
  title: 'Roughly how much do you spend on cards each month?',
  help: 'Your best estimate across all cards, in rupees.',
  min: 0, maxValue: 100_00_000, unit: '₹ / month', placeholder: 'e.g. 45000', step: 1000,
};

const Q_CATEGORIES: Question = {
  id: 'categories',
  kind: 'multi',
  max: 3,
  title: 'Where does most of your spending go? (pick up to 3)',
  options: CATEGORY_OPTIONS,
};

const Q_AGE: Question = {
  id: 'age',
  kind: 'number',
  title: 'How old are you?',
  help: 'Some cards have minimum or maximum age limits.',
  min: 18, maxValue: 100, unit: 'years', placeholder: 'e.g. 29', step: 1,
};

const Q_EMPLOYMENT: Question = {
  id: 'employment',
  kind: 'single',
  title: 'What best describes your employment?',
  options: [
    { value: 'salaried', label: 'Salaried' },
    { value: 'self_employed', label: 'Self-employed' },
    { value: 'student', label: 'Student' },
    { value: 'not_employed', label: 'Not currently employed' },
  ],
};

const Q_INCOME: Question = {
  id: 'income',
  kind: 'number',
  title: 'What is your annual income?',
  help: 'Used only to filter cards you can realistically be approved for.',
  min: 0, maxValue: 10_00_00_000, unit: '₹ / year', placeholder: 'e.g. 900000', step: 50000,
};

const Q_CIBIL: Question = {
  id: 'cibil',
  kind: 'single',
  title: 'Your best estimate of your CIBIL score?',
  options: [
    { value: '750_plus', label: '750+ (Excellent)' },
    { value: '700_749', label: '700–749 (Good)' },
    { value: '650_699', label: '650–699 (Fair)' },
    { value: 'new_to_credit', label: 'New to credit' },
    { value: 'not_sure', label: 'Not sure' },
  ],
};

/* ---- branch questions ---- */
const Q_FLIGHTS: Question = {
  id: 'flights',
  kind: 'single',
  title: 'How often do you fly in a year?',
  options: [
    { value: 'never', label: 'I don’t fly' },
    { value: '1_2', label: '1–2 times' },
    { value: '3_6', label: '3–6 times' },
    { value: '7_plus', label: '7+ times' },
  ],
};

const Q_TRAVEL_SCOPE: Question = {
  id: 'travel_scope',
  kind: 'single',
  title: 'Do you spend abroad or in foreign currency?',
  help: 'Foreign-currency markup (forex) matters if you do.',
  options: [
    { value: 'domestic_only', label: 'Mostly within India' },
    { value: 'international', label: 'Yes, I spend abroad / online in USD' },
  ],
};

const Q_FEE_APPETITE: Question = {
  id: 'fee_appetite',
  kind: 'single',
  title: 'How do you feel about annual fees?',
  options: [
    { value: 'lifetime_free_only', label: 'Prefer lifetime-free only' },
    { value: 'value_over_fee', label: 'A fee is fine if the value clearly beats it' },
    { value: 'no_preference', label: 'No preference' },
  ],
};

const Q_CREDIT_HISTORY: Question = {
  id: 'credit_history',
  kind: 'single',
  title: 'How long have you had credit (loans or cards)?',
  options: [
    { value: 'none', label: 'None yet' },
    { value: 'lt1', label: 'Less than a year' },
    { value: '1_3', label: '1–3 years' },
    { value: '3_plus', label: 'More than 3 years' },
  ],
};

const Q_OPEN_SECURED: Question = {
  id: 'open_secured',
  kind: 'single',
  title: 'Open to a secured (fixed-deposit-backed) card to start?',
  help: 'These are easy to get approved for and help build your score.',
  options: [
    { value: 'yes', label: 'Yes, that’s fine' },
    { value: 'no', label: 'Prefer a regular card' },
  ],
};

/** number_group built from the categories the user picked. */
function categoryAmountsQuestion(answers: AnswerMap): Question {
  const picked = (Array.isArray(answers.categories) ? (answers.categories as string[]) : []) as SpendCategoryKey[];
  const fields: NumberField[] = picked.map((key) => ({ key, label: SPEND_CATEGORY_LABELS[key] ?? key }));
  return {
    id: 'category_amounts',
    kind: 'number_group',
    title: 'About how much do you spend on each, per month?',
    help: 'Rupees per month. Rough numbers are fine.',
    unit: '₹ / month',
    fields,
  };
}

/* ---- the tree: returns the ordered 10 questions for the current answers ---- */
export function orderedQuestions(answers: AnswerMap): Question[] {
  const seq: Question[] = [
    Q_GOAL,
    Q_MONTHLY_SPEND,
    Q_CATEGORIES,
    categoryAmountsQuestion(answers),
    Q_AGE,
    Q_EMPLOYMENT,
    Q_INCOME,
    Q_CIBIL,
  ];

  const goal = answers.goal as string | undefined;
  const employment = answers.employment as string | undefined;
  const cibil = answers.cibil as string | undefined;

  const isTraveller = goal === 'travel_miles' || goal === 'lounge_access';
  const isNewUser = goal === 'first_card' || employment === 'student' || cibil === 'new_to_credit';

  if (isTraveller) {
    seq.push(Q_FLIGHTS, Q_TRAVEL_SCOPE);
  } else if (isNewUser) {
    seq.push(Q_CREDIT_HISTORY, Q_OPEN_SECURED);
  } else {
    seq.push(Q_FLIGHTS, Q_FEE_APPETITE);
  }

  return seq;
}

/** Whether the current answer for a question lets the user advance. */
export function canAdvance(q: Question, value: AnswerMap[string] | undefined): boolean {
  if (q.kind === 'single') return typeof value === 'string' && value.length > 0;
  if (q.kind === 'multi') return Array.isArray(value) && value.length > 0;
  if (q.kind === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= (q.min ?? 0);
  if (q.kind === 'number_group') {
    if (!q.fields || q.fields.length === 0) return false;
    const rec = (value ?? {}) as Record<string, number>;
    return q.fields.every((f) => typeof rec[f.key] === 'number' && Number.isFinite(rec[f.key]) && rec[f.key] >= 0);
  }
  return false;
}

const FLIGHTS_TO_COUNT: Record<string, number> = { never: 0, '1_2': 2, '3_6': 5, '7_plus': 10 };

/** Collapse the raw answer map into the engine's typed input. */
export function toRecommendAnswers(answers: AnswerMap): RecommendAnswers {
  const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const catAmounts = (answers.category_amounts ?? {}) as Record<string, number>;
  const category_spend: RecommendAnswers['category_spend'] = {};
  for (const [k, v] of Object.entries(catAmounts)) {
    if (typeof v === 'number' && v > 0) category_spend[k as SpendCategoryKey] = v;
  }
  const flights = FLIGHTS_TO_COUNT[(answers.flights as string) ?? 'never'] ?? 0;
  return {
    age: num(answers.age),
    employment_type: (answers.employment as RecommendAnswers['employment_type']) ?? 'salaried',
    annual_income_inr: num(answers.income),
    cibil_band: (answers.cibil as RecommendAnswers['cibil_band']) ?? 'not_sure',
    goal: (answers.goal as string) ?? 'cashback',
    monthly_spend_inr: num(answers.monthly_spend),
    category_spend,
    flights_per_year: flights,
    travel_international: answers.travel_scope === 'international',
    fee_appetite: (answers.fee_appetite as RecommendAnswers['fee_appetite']) ?? 'no_preference',
    new_to_credit: answers.cibil === 'new_to_credit' || answers.credit_history === 'none',
  };
}
