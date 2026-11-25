import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProductOrgPage from './ProductOrgPage';
import { KitSection } from './subpageKit';
import MoreCards from './MoreCards';
import { SITE_URL } from '../../utils/seo';
import { PAYROLL_PRODUCT_PAGE, FEATURE_PAGES, INTEGRATIONS_CARD } from '../../content/marketing/featurePages';

// ── Lön och arbetsgivare (/lon) ─────────────────────────────────────────
// 2026-11-07: samma produktsida som bolagsformerna och funktionssidorna,
// med riktiga bilder ur appen. Innehållet ligger i featurePages.js
// (PAYROLL_PRODUCT_PAGE).

const page = PAYROLL_PRODUCT_PAGE;

const SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Lön och arbetsgivare i Bokix',
    url: `${SITE_URL}${page.path}`,
    inLanguage: 'sv-SE',
    description: page.seoDescription,
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  },
];

export default function PayrollPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  const more = (
    <KitSection title="Mer i Bokix" lead="Allt finns i samma bokföringsprogram, till samma pris." alt>
      <MoreCards pages={[...FEATURE_PAGES, INTEGRATIONS_CARD]} />
    </KitSection>
  );
  return <ProductOrgPage page={page} schemas={SCHEMAS} enterApp={enterApp} subject="lönen" more={more} />;
}
