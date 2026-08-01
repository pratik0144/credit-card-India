/*
 * JSON-LD structured-data builders (FRONTEND_PROMPT.md §9). Emitted via
 * BaseLayout's jsonLd prop. Keeps schema construction out of page templates.
 */
import { SITE } from './site';
import { groupIndian } from './format';
import type { Card, Bank, CardRating } from './database.types';

export function breadcrumbList(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: new URL(it.path, SITE.url).href,
    })),
  };
}

/** FinancialProduct markup for a card review page (§9). */
export function financialProduct(
  card: Card,
  bank: Bank,
  rating: CardRating | null,
  path: string,
): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: card.name,
    url: new URL(path, SITE.url).href,
    category: 'Credit Card',
    brand: { '@type': 'BankOrCreditUnion', name: bank.name },
  };
  if (card.image_url) obj.image = card.image_url;
  if (card.annual_fee_amount != null) {
    obj.feesAndCommissionsSpecification = `Annual fee: ₹${groupIndian(card.annual_fee_amount)}`;
  }
  if (rating?.overall_score != null) {
    obj.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.overall_score,
      bestRating: 5,
      ratingCount: 1,
      reviewCount: 1,
    };
  }
  return obj;
}

export function faqPage(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function articleSchema(
  opts: { title: string; description: string; path: string; author?: string; published?: string | null; updated?: string | null; image?: string | null },
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    url: new URL(opts.path, SITE.url).href,
    ...(opts.author ? { author: { '@type': 'Person', name: opts.author } } : {}),
    ...(opts.published ? { datePublished: opts.published } : {}),
    ...(opts.updated ? { dateModified: opts.updated } : {}),
    ...(opts.image ? { image: opts.image } : {}),
    publisher: { '@type': 'Organization', name: SITE.name },
  };
}

/**
 * Organization + WebSite (with SearchAction for the Google sitelinks
 * searchbox), homepage ONLY (SEO_PROMPT §4).
 *
 * NOTE on `logo`: Google's logo guidelines want a crawlable raster (PNG/JPG),
 * not SVG, so we point at the 1200×630 OG raster rather than favicon.svg.
 * NOTE on `sameAs`: intentionally omitted until real, verified social profiles
 * exist (footer links are still `#` placeholders). Pointing Google at guessed
 * profiles would poison the entity, so we add it only when handles are real.
 */
export function organizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    logo: new URL('/og-default.png', SITE.url).href,
    description: SITE.tagline,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@cardcompare.in',
      areaServed: 'IN',
      availableLanguage: ['en'],
    },
    // sameAs: [ ... ]  // TODO: add once verified X/Instagram/YouTube profiles exist.
  };
}

/**
 * ItemList for the homepage featured-card reel (SEO_PROMPT §4). Gives Google an
 * ordered, URL-bearing list so the set can qualify as a carousel-rich result.
 * Items must carry real URLs to be useful, so callers pass the review path.
 */
export function itemListSchema(
  items: { name: string; path: string; image?: string | null }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: new URL(it.path, SITE.url).href,
      ...(it.image ? { image: it.image } : {}),
    })),
  };
}

export function webSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    inLanguage: SITE.lang,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
