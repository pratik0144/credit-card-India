/*
 * Spec → qualitative tier mappings for ScoreTierBadge (DESIGN §6.14).
 * Thresholds are working editorial values; adjust with the content team.
 */
import type { Tier } from '../components/ScoreTierBadge.astro';

/** Annual fee → tier (lower is better). Lifetime-free is Excellent. */
export function annualFeeTier(fee: number | null | undefined): { tier: Tier; label: string } {
  if (fee == null) return { tier: 'fair', label: 'Not disclosed' };
  if (fee === 0) return { tier: 'excellent', label: 'Lifetime Free' };
  if (fee <= 500) return { tier: 'very-good', label: 'Low' };
  if (fee <= 2500) return { tier: 'good', label: 'Moderate' };
  if (fee <= 10000) return { tier: 'fair', label: 'Premium' };
  return { tier: 'poor', label: 'High' };
}

/** Forex markup % → tier (lower is better). */
export function forexTier(pct: number | null | undefined): { tier: Tier; label: string } {
  if (pct == null) return { tier: 'fair', label: 'Not disclosed' };
  if (pct <= 1) return { tier: 'excellent', label: 'Very Low' };
  if (pct <= 2) return { tier: 'very-good', label: 'Low' };
  if (pct <= 3.5) return { tier: 'good', label: 'Standard' };
  return { tier: 'fair', label: 'High' };
}

/**
 * Minimum CIBIL requirement → accessibility tier. A LOWER requirement is more
 * accessible; we phrase the label around the score band an applicant needs.
 */
export function cibilTier(min: number | null | undefined): { tier: Tier; label: string } {
  if (min == null) return { tier: 'good', label: 'Flexible' };
  if (min >= 750) return { tier: 'excellent', label: '750+ recommended' };
  if (min >= 700) return { tier: 'very-good', label: '700+ recommended' };
  if (min >= 650) return { tier: 'good', label: '650+ recommended' };
  return { tier: 'fair', label: 'New-to-credit friendly' };
}

/** Reward rate ₹/₹100 → value tier (higher is better). */
export function rewardValueTier(per100: number | null | undefined): { tier: Tier; label: string } {
  if (per100 == null) return { tier: 'fair', label: 'Unknown' };
  if (per100 >= 5) return { tier: 'excellent', label: 'Excellent' };
  if (per100 >= 3) return { tier: 'very-good', label: 'Very Good' };
  if (per100 >= 1.5) return { tier: 'good', label: 'Good' };
  if (per100 >= 0.5) return { tier: 'fair', label: 'Fair' };
  return { tier: 'poor', label: 'Low' };
}
