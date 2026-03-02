/**
 * Premium Lingua logo — a stylized speech-bubble containing an elegant "L"
 * with a subtle accent dot, evoking conversation + language learning.
 */
export function LinguaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Speech bubble shape */}
      <path
        d="M4 4.5C4 3.12 5.12 2 6.5 2h11C18.88 2 20 3.12 20 4.5v10c0 1.38-1.12 2.5-2.5 2.5H10l-4.3 3.6a.75.75 0 01-1.2-.6V17h-.5A2.5 2.5 0 011.5 14.5v-8C1.5 5.12 2.62 4 4 4.5z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M3.5 4C3.5 2.9 4.4 2 5.5 2H18.5C19.6 2 20.5 2.9 20.5 4V14C20.5 15.1 19.6 16 18.5 16H10.5L6 19.8C5.6 20.1 5 19.8 5 19.3V16H3.5C2.4 16 1.5 15.1 1.5 14V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Stylized "L" */}
      <path
        d="M8 6.5V13H14.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Accent dot — language spark */}
      <circle cx="18" cy="6" r="1.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
