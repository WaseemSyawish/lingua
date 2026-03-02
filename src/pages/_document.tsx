import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Primary SVG favicon (scalable) */}
        <link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml" />
        {/* Fallback and explicit sizes for platforms that prefer bitmap icons */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="48x48" />
        <link rel="apple-touch-icon" href="/favicon.svg" sizes="180x180" />
        <link rel="mask-icon" href="/favicon.svg" color="#F59E0B" />
        <meta name="theme-color" content="#111827" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
