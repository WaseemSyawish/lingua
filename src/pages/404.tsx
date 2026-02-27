import Button from "@/components/ui/Button";
import Head from "next/head";
import { useRouter } from "next/router";

export default function Custom404() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Page Not Found | Lingua</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-8 text-center">
        <div className="w-20 h-20 mb-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <span className="text-4xl">🔍</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          404 — Page Not Found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => router.back()} variant="secondary">
            Go Back
          </Button>
          <Button onClick={() => router.push("/dashboard")} variant="primary">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </>
  );
}
