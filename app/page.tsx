import { Deposit } from "./deposit";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Lock tokens</h1>
      <p className="mt-2 mb-8 text-foreground/70">
        Lock any ERC20 token on Robinhood Chain until a time you choose. Only the withdrawer can
        claim it, and only once it unlocks.
      </p>
      <Deposit />
    </main>
  );
}
