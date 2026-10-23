"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { type Address, erc20Abi, isAddress, isAddressEqual } from "viem";
import { useReadContracts } from "wagmi";
import { errorMessage, isRpcError } from "../errors";
import { formatTime, shortAddress } from "../format";
import { formatAmount, LockDetails, type Token } from "../locks/lock-details";
import { type Lock, useLocks } from "../locks/use-locks";
import { timeLockAddresses } from "../timelock";
import { Notice } from "../timelock-gate";
import { type Chain, config } from "../wagmi";

// The networks TimeLock is deployed on, mainnet first.
const networks = config.chains.flatMap((chain) => {
  const timeLock = timeLockAddresses[chain.id];
  return timeLock ? [{ chain, timeLock }] : [];
});

export function TokenLocks() {
  // Generated ids: with Cache Components, pages you've left stay in the DOM, so a fixed id like
  // "token" would clash with the deposit form's.
  const id = useId();
  // The URL says which network and token are shown, so the page can be shared. That also keeps a
  // link here working when the page is already mounted from an earlier visit.
  const searchParams = useSearchParams();
  const network =
    networks.find(({ chain }) => chain.id === Number(searchParams.get("chain"))) ?? networks[0];
  const urlToken = searchParams.get("token") ?? "";

  // What's typed, which may be a partial address. It's reset whenever the URL's token changes.
  const [tokenInput, setTokenInput] = useState(urlToken);
  const [inputFor, setInputFor] = useState(urlToken);
  if (inputFor !== urlToken) {
    setInputFor(urlToken);
    setTokenInput(urlToken);
  }

  if (!network) return <Notice>TimeLock isn&apos;t deployed on any network yet.</Notice>;
  const token = isAddress(tokenInput) ? tokenInput : undefined;

  function updateUrl(chain: Chain, input: string) {
    const tokenParam = isAddress(input) ? `&token=${input}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}?chain=${chain.id}${tokenParam}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {networks.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-network`} className="text-sm font-medium">
              Network
            </label>
            <select
              id={`${id}-network`}
              value={network.chain.id}
              onChange={(event) => {
                const next = networks.find(({ chain }) => chain.id === Number(event.target.value));
                if (next) updateUrl(next.chain, tokenInput);
              }}
              className="rounded-xl border border-foreground/15 bg-background px-3 py-2.5"
            >
              {networks.map(({ chain }) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-token`} className="text-sm font-medium">
            Token contract address
          </label>
          <input
            id={`${id}-token`}
            value={tokenInput}
            onChange={(event) => {
              const input = event.target.value.trim();
              setTokenInput(input);
              if (input === "" || isAddress(input)) updateUrl(network.chain, input);
            }}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={tokenInput !== "" && !token}
            aria-describedby={`${id}-token-message`}
            className="w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 font-mono outline-none focus:border-foreground/40 aria-invalid:border-red-600 dark:aria-invalid:border-red-400"
          />
          {tokenInput !== "" && !token && (
            <p id={`${id}-token-message`} className="text-sm text-red-600 dark:text-red-400">
              Enter a valid address.
            </p>
          )}
        </div>
      </div>

      {token && (
        <TokenLockList
          key={`${network.chain.id}:${token}`}
          chain={network.chain}
          timeLock={network.timeLock}
          token={token}
        />
      )}
    </div>
  );
}

function TokenLockList({ chain, timeLock, token }: { chain: Chain; timeLock: Address; token: Address }) {
  const { locks: all, error } = useLocks(chain.id, timeLock);
  const locks = all?.filter((lock) => isAddressEqual(lock.token, token));
  const tokenReads = useReadContracts({
    allowFailure: false,
    chainId: chain.id,
    contracts: [
      { address: token, abi: erc20Abi, functionName: "symbol" },
      { address: token, abi: erc20Abi, functionName: "decimals" },
      { address: token, abi: erc20Abi, functionName: "totalSupply" },
    ],
    // No retries: viem already retries failed RPC requests, and a contract that isn't an ERC20
    // fails the same way every time.
    query: { retry: false },
  });

  if (error) return <Notice>Couldn&apos;t load locks: {errorMessage(error)}</Notice>;
  if (isRpcError(tokenReads.error)) {
    return <Notice>Couldn&apos;t look up this token: {errorMessage(tokenReads.error)}</Notice>;
  }
  if (!locks || tokenReads.isPending) return <Notice>Loading locks…</Notice>;

  const [symbol, decimals, totalSupply] = tokenReads.data ?? [];
  const info: Token = symbol !== undefined && decimals !== undefined ? { symbol, decimals } : null;
  if (locks.length === 0) {
    return (
      <Notice>
        {info ? `No ${info.symbol} locks` : "No locks for this address"} on {chain.name}.{" "}
        <Link href="/" className="underline underline-offset-2">
          Lock tokens
        </Link>
      </Notice>
    );
  }

  // Locks are sorted with the locked ones by unlock time, so the first is the next to unlock.
  const locked = locks.filter((lock) => lock.status === "Locked");
  const lockedAmount = locked.reduce((sum, lock) => sum + lock.amount, BigInt(0));
  const count = (status: Lock["status"]) => locks.filter((lock) => lock.status === status).length;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-foreground/15 p-4">
        <div>
          <h2 className="font-semibold">{info ? info.symbol : shortAddress(token)}</h2>
          <a
            href={`${chain.blockExplorers.default.url}/token/${token}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm break-all text-foreground/60 hover:underline"
          >
            {token}
          </a>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-foreground/60">Locked now</dt>
          <dd>{formatAmount(lockedAmount, info)}</dd>
          {totalSupply !== undefined && totalSupply > BigInt(0) && (
            <>
              <dt className="text-foreground/60">Share of supply</dt>
              <dd>{formatPercent(lockedAmount, totalSupply)}</dd>
            </>
          )}
          {locked.length > 0 && (
            <>
              <dt className="text-foreground/60">Next unlock</dt>
              <dd>{formatTime(locked[0].unlockTime)}</dd>
            </>
          )}
          <dt className="text-foreground/60">Locks</dt>
          <dd>
            {locks.length} ({count("Locked")} locked · {count("Unlocked")} unlocked · {count("Withdrawn")}{" "}
            withdrawn)
          </dd>
        </dl>
      </section>

      <ul className="flex flex-col gap-3">
        {locks.map((lock) => (
          <li key={lock.id.toString()} className="flex flex-col gap-3 rounded-2xl border border-foreground/15 p-4">
            <LockDetails lock={lock} token={info} chain={chain} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Rounds down, so a share is never overstated (99.999% shows as 99.99%, not 100%).
function formatPercent(part: bigint, whole: bigint) {
  const basisPoints = (part * BigInt(10_000)) / whole;
  if (basisPoints === BigInt(0) && part > BigInt(0)) return "under 0.01%";
  return `${(Number(basisPoints) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}
