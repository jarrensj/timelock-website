"use client";

import { Fragment, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { useConnection } from "wagmi";
import { timeLockAddresses } from "./timelock";
import type { Chain } from "./wagmi";

// Renders `children` once a wallet is connected to a network where TimeLock is deployed, and
// otherwise says what's missing. `purpose` finishes the sentence "Connect a wallet to …".
export function TimeLockGate({
  purpose,
  children,
}: {
  purpose: string;
  children: (props: { account: Address; chain: Chain; timeLock: Address }) => React.ReactNode;
}) {
  const { address, chain } = useConnection();
  // wagmi starts reconnecting before the page hydrates, so render the server's disconnected
  // state until it has, or hydration won't match.
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  if (!hydrated || !address) return <Notice>Connect a wallet to {purpose}.</Notice>;
  if (!chain) return <Notice>Switch your wallet to Robinhood Chain to {purpose}.</Notice>;
  const timeLock = timeLockAddresses[chain.id];
  if (!timeLock) return <Notice>TimeLock isn&apos;t deployed on {chain.name} yet.</Notice>;

  // Keyed so that switching account or network starts fresh.
  return (
    <Fragment key={`${chain.id}:${address}`}>{children({ account: address, chain, timeLock })}</Fragment>
  );
}

function subscribeToNothing() {
  return () => {};
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-foreground/15 p-5 text-sm text-foreground/70">{children}</p>
  );
}
