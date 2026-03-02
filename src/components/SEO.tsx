import Head from "next/head";

interface SEOProps {
  title?: string;
  description?: string;
  noIndex?: boolean;
}

export default function SEO({
  title,
  description = "Learn French with your personal AI tutor. Adaptive conversations, progress tracking, and structured curriculum from A0 to C2.",
  noIndex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} | Lingua` : "Lingua — AI French Tutor";

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <link rel="icon" href="/favicon.ico" />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
    </Head>
  );
}
