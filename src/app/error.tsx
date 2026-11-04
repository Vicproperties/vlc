"use client";

import { Button } from "@/components/ui/button";

// Never render error.message to visitors: it may contain internal details.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="container-content flex flex-1 flex-col justify-center py-32">
      <p className="mb-6 eyebrow">Something went wrong</p>
      <h1 className="max-w-2xl text-h1">We could not load this page.</h1>
      <p className="mt-6 max-w-xl text-body-lg text-stone">Please try again. If the problem continues, contact us.</p>
      <div className="mt-10">
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
