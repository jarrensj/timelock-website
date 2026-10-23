"use client";

import Link from "next/link";
import { useState } from "react";
import { type Address, erc20Abi, isAddressEqual } from "viem";
import { useReadContracts, useWriteContract } from "wagmi";
import { errorMessage } from "../errors";
import { timeLockAbi } from "../timelock";
import { Notice, TimeLockGate } from "../timelock-gate";
import { waitForSuccess } from "../transactions";
import type { Chain } from "../wagmi";
import { ChangeWithdrawer } from "./change-withdrawer";
import { LockDetails, type Token } from "./lock-details";
import { type Lock, useLocks } from "./use-locks";

export function Locks() {
  return <TimeLockGate purpose="see your locks">{(props) => <LockList {...props} />}</TimeLockGate>;
}

function LockList({ account, chain, timeLock }: { account: Address; chain: Chain; timeLock: Address }) {
  const { locks: all, error, refetch } = useLocks(chain.id, timeLock);
  const locks = all?.filter(
    (lock) => isAddressEqual(lock.withdrawer, account) || isAddressEqual(lock.depositor, account),
  );

  const tokenAddresses = [...new Set(locks?.map((lock) => lock.token))];
  const tokenReads = useReadContracts({
    chainId: chain.id,
    contracts: tokenAddresses.flatMap(
      (address) =>
        [
          { address, abi: erc20Abi, functionName: "symbol" },
          { address, abi: erc20Abi, functionName: "decimals" },
        ] as const,
    ),
    query: { enabled: tokenAddresses.length > 0 },
  });
  const tokens = new Map<Address, Token>(
    tokenAddresses.map((address, i) => {
      if (!tokenReads.data) return [address, undefined];
      const symbol = tokenReads.data[2 * i].result;
      const decimals = tokenReads.data[2 * i + 1].result;
      return [
        address,
        typeof symbol === "string" && typeof decimals === "number" ? { symbol, decimals } : null,
      ];
    }),
  );

  if (error) return <Notice>Couldn&apos;t load locks: {errorMessage(error)}</Notice>;
  if (!locks) return <Notice>Loading your locks…</Notice>;
  if (locks.length === 0) {
    return (
      <Notice>
        You don&apos;t have any locks on {chain.name} yet.{" "}
        <Link href="/" className="underline underline-offset-2">
          Lock tokens
        </Link>
      </Notice>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {locks.map((lock) => (
        <LockRow
          key={lock.id.toString()}
          lock={lock}
          token={tokens.get(lock.token)}
          account={account}
          chain={chain}
          timeLock={timeLock}
          onUpdated={refetch}
        />
      ))}
    </ul>
  );
}

function LockRow({
  lock,
  token,
  account,
  chain,
  timeLock,
  onUpdated,
}: {
  lock: Lock;
  token: Token;
  account: Address;
  chain: Chain;
  timeLock: Address;
  onUpdated: () => Promise<unknown>;
}) {
  const { mutateAsync: writeContract } = useWriteContract();
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string>();

  const youWithdraw = isAddressEqual(lock.withdrawer, account);
  const youDeposited = isAddressEqual(lock.depositor, account);
  const canWithdraw = youWithdraw && lock.status === "Unlocked";

  async function withdraw() {
    setError(undefined);
    setWithdrawing(true);
    try {
      await waitForSuccess(
        await writeContract({
          address: timeLock,
          abi: timeLockAbi,
          functionName: "withdraw",
          args: [lock.id],
          chainId: chain.id,
        }),
        chain.id,
      );
      await onUpdated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-foreground/15 p-4">
      <LockDetails lock={lock} token={token} chain={chain} account={account} />

      {youWithdraw && !youDeposited && !lock.withdrawn && (
        <p className="text-sm text-foreground/60">
          The depositor can change the withdrawer until you withdraw.
        </p>
      )}

      {canWithdraw && (
        <button
          type="button"
          onClick={withdraw}
          disabled={withdrawing}
          className="rounded-full bg-foreground px-4 py-2.5 font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {withdrawing ? "Withdrawing…" : "Withdraw"}
        </button>
      )}
      {withdrawing && (
        <p className="text-sm text-foreground/70">Confirm in your wallet, then wait for the transaction to land.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Every listed lock has you as its depositor or withdrawer, so you can change it. */}
      {!lock.withdrawn && (
        <ChangeWithdrawer
          lock={lock}
          account={account}
          chain={chain}
          timeLock={timeLock}
          onChanged={onUpdated}
        />
      )}
    </li>
  );
}
