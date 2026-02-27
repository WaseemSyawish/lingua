import Head from "next/head";

interface SEOProps {
  title?: string;
  description?: string;
  noIndex?: boolean;
}

const SITE_NAME = "Lingua — AI French Tutor";
const DEFAULT_DESCRIPTION =
  "Learn French with Amélie, your AI-powered personal tutor. Adaptive lessons from A0 to C2, conversation practice, and intelligent progress tracking.";

export default function SEO({ title, description = DEFAULT_DESCRIPTION, noIndex = false }: SEOProps) {
  const fullTitle = title ? `${title} | Lingua` : SITE_NAME;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta charSet="utf-8" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="Lingua" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />

      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />

      {/* Theme */}
      <meta name="theme-color" content="#6366f1" />

      {noIndex && <meta name="robots" content="noindex,nofollow" />}
    </Head>
  );
}
