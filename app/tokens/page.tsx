import { Suspense } from "react";
import { TokenLocks } from "./token-locks";

export default function TokensPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Token locks</h1>
      <p className="mt-2 mb-8 text-foreground/70">
        Paste a token&apos;s contract address to see every lock for it. No wallet needed, and the link
        can be shared.
      </p>
      {/* TokenLocks reads the URL's search params, which aren't known when the page is prerendered. */}
      <Suspense>
        <TokenLocks />
      </Suspense>
    </main>
  );
}
