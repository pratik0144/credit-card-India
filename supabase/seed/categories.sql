-- =====================================================================
-- seed/categories.sql — content/nav taxonomy (§6).
-- EXACTLY the CONTENT_CATEGORIES set from src/lib/taxonomy.ts.
-- Deliberately NO "0% APR" (DESIGN.md §10.9 -> "Low Interest").
-- Idempotent: re-runnable via upsert on slug.
-- =====================================================================

insert into public.categories (slug, name, description, display_order) values
  ('cashback',       'Cashback',       'Cards that return a percentage of spend as cashback or cash-equivalent points.', 10),
  ('travel',         'Travel',         'Cards optimized for flights, hotels, air miles, and international travel.',       20),
  ('rewards',        'Rewards',        'General reward-points cards redeemable across a catalog or transfer partners.',   30),
  ('fuel',           'Fuel',           'Cards with accelerated fuel rewards and fuel-surcharge waivers.',                 40),
  ('lifetime-free',  'Lifetime Free',  'Cards with no joining or annual fee for the life of the card.',                   50),
  ('business',       'Business',       'Cards for businesses, corporates, and self-employed professionals.',              60),
  ('low-interest',   'Low Interest',   'Cards with lower finance charges or favourable EMI conversion terms.',            70),
  ('student',        'Student',        'Entry-level cards for students and new-to-credit applicants.',                    80),
  ('super-premium',  'Super Premium',  'Invite-only and top-tier cards with concierge, unlimited lounge, and elite perks.',90),
  ('airport-lounge', 'Airport Lounge', 'Cards whose headline benefit is complimentary domestic/international lounge access.',100),
  ('dining',         'Dining',         'Cards with accelerated rewards and offers on restaurants and food delivery.',     110),
  ('shopping',       'Shopping',       'Cards optimized for online and retail shopping rewards.',                         120)
on conflict (slug) do update set
  name          = excluded.name,
  description   = excluded.description,
  display_order = excluded.display_order,
  updated_at    = now();
