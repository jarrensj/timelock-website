"use client";

import Link from "next/link";
import { useState } from "react";
import { type Address, erc20Abi, formatUnits, isAddressEqual } from "viem";
import { useBlock, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { errorMessage } from "../errors";
import { formatTime, shortAddress } from "../format";
import { timeLockAbi } from "../timelock";
import { Notice, TimeLockGate } from "../timelock-gate";
import { waitForSuccess } from "../transactions";
import type { Chain } from "../wagmi";
import { ChangeWithdrawer } from "./change-withdrawer";

export function Locks() {
  return <TimeLockGate purpose="see your locks">{(props) => <LockList {...props} />}</TimeLockGate>;
}

export type Lock = {
  id: bigint;
  token: Address;
  depositor: Address;
  withdrawer: Address;
  amount: bigint;
  unlockTime: bigint;
  withdrawn: boolean;
};

// undefined while loading, null if the token's symbol or decimals couldn't be read.
type Token = { symbol: string; decimals: number } | null | undefined;

function LockList({ account, chain, timeLock }: { account: Address; chain: Chain; timeLock: Address }) {
  const count = useReadContract({
    address: timeLock,
    abi: timeLockAbi,
    functionName: "lockCount",
    chainId: chain.id,
  });
  // TODO: this reads every lock to find the user's. Once there are too many for that, find them
  // through the Deposited and WithdrawerUpdated logs or an indexer instead.
  const all = useReadContracts({
    allowFailure: false,
    chainId: chain.id,
    contracts: Array.from(
      { length: Number(count.data ?? 0) },
      (_, id) => ({ address: timeLock, abi: timeLockAbi, functionName: "getLock", args: [BigInt(id)] }) as const,
    ),
    query: { enabled: count.data !== undefined },
  });
  // The contract compares unlock times with the block timestamp, which can run ahead of real time.
  const block = useBlock({ chainId: chain.id, query: { refetchInterval: 30_000 } });
  const chainTime = block.data?.timestamp;

  const locks: Lock[] = (all.data ?? [])
    .map((lock, id) => ({ ...lock, id: BigInt(id) }))
    .filter((lock) => isAddressEqual(lock.withdrawer, account) || isAddressEqual(lock.depositor, account));
  const isUnlocked = (lock: Lock) => chainTime !== undefined && chainTime >= lock.unlockTime;
  // Unlocked first, then locked by when they unlock, then withdrawn.
  const rank = (lock: Lock) => (lock.withdrawn ? 2 : isUnlocked(lock) ? 0 : 1);
  locks.sort((a, b) => rank(a) - rank(b) || Number(a.unlockTime - b.unlockTime));

  const tokenAddresses = [...new Set(locks.map((lock) => lock.token))];
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

  const error = count.error ?? all.error;
  if (error) return <Notice>Couldn&apos;t load locks: {errorMessage(error)}</Notice>;
  if (!all.data) return <Notice>Loading your locks…</Notice>;
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
          unlocked={isUnlocked(lock)}
          account={account}
          chain={chain}
          timeLock={timeLock}
          onUpdated={() => all.refetch()}
        />
      ))}
    </ul>
  );
}

const statusClass = {
  Unlocked: "bg-green-600/15 text-green-700 dark:text-green-400",
  Locked: "bg-foreground/10 text-foreground/70",
  Withdrawn: "bg-foreground/5 text-foreground/50",
};

function LockRow({
  lock,
  token,
  unlocked,
  account,
  chain,
  timeLock,
  onUpdated,
}: {
  lock: Lock;
  token: Token;
  unlocked: boolean;
  account: Address;
  chain: Chain;
  timeLock: Address;
  onUpdated: () => Promise<unknown>;
}) {
  const { mutateAsync: writeContract } = useWriteContract();
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string>();

  const status = lock.withdrawn ? "Withdrawn" : unlocked ? "Unlocked" : "Locked";
  const youWithdraw = isAddressEqual(lock.withdrawer, account);
  const youDeposited = isAddressEqual(lock.depositor, account);
  const canWithdraw = youWithdraw && status === "Unlocked";

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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {token === undefined
              ? "…"
              : token
                ? `${formatUnits(lock.amount, token.decimals)} ${token.symbol}`
                : `${lock.amount} units`}
          </p>
          <p className="text-sm text-foreground/60">
            Lock #{lock.id.toString()} ·{" "}
            <a
              href={`${chain.blockExplorers.default.url}/token/${lock.token}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:underline"
            >
              {shortAddress(lock.token)}
            </a>
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass[status]}`}>
          {status}
        </span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-foreground/60">{status === "Locked" ? "Unlocks" : "Unlocked"}</dt>
        <dd>{formatTime(lock.unlockTime)}</dd>
        <dt className="text-foreground/60">Withdrawer</dt>
        <dd>
          <AddressOrYou address={lock.withdrawer} account={account} />
        </dd>
        <dt className="text-foreground/60">Depositor</dt>
        <dd>
          <AddressOrYou address={lock.depositor} account={account} />
        </dd>
      </dl>

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

function AddressOrYou({ address, account }: { address: Address; account: Address }) {
  if (isAddressEqual(address, account)) return "You";
  return <span className="font-mono">{shortAddress(address)}</span>;
}
