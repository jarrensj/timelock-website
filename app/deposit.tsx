"use client";

import Link from "next/link";
import { useState } from "react";
import {
  type Address,
  type Hash,
  erc20Abi,
  formatUnits,
  isAddress,
  isAddressEqual,
  parseEventLogs,
  parseUnits,
  zeroAddress,
} from "viem";
import { useReadContracts, useWriteContract } from "wagmi";
import { errorMessage, isRpcError } from "./errors";
import { formatTime } from "./format";
import { timeLockAbi } from "./timelock";
import { TimeLockGate } from "./timelock-gate";
import { waitForSuccess } from "./transactions";
import type { Chain } from "./wagmi";

export function Deposit() {
  return <TimeLockGate purpose="lock tokens">{(props) => <DepositForm {...props} />}</TimeLockGate>;
}

type Lock = { id: bigint; token: Address; amount: string; symbol: string; unlockTime: bigint; hash: Hash };

function DepositForm({ account, chain, timeLock }: { account: Address; chain: Chain; timeLock: Address }) {
  const { mutateAsync: writeContract } = useWriteContract();
  const [tokenInput, setTokenInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [withdrawerInput, setWithdrawerInput] = useState("");
  const [status, setStatus] = useState<"idle" | "approving" | "locking">("idle");
  const [error, setError] = useState<string>();
  const [lock, setLock] = useState<Lock>();

  const tokenAddress = isAddress(tokenInput) ? tokenInput : undefined;
  const token = useReadContracts({
    allowFailure: false,
    chainId: chain.id,
    contracts: [
      { address: tokenAddress, abi: erc20Abi, functionName: "symbol" },
      { address: tokenAddress, abi: erc20Abi, functionName: "decimals" },
      { address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [account] },
      { address: tokenAddress, abi: erc20Abi, functionName: "allowance", args: [account, timeLock] },
    ],
    // No retries: viem already retries failed RPC requests, and a contract that isn't an ERC20
    // fails the same way every time.
    query: { enabled: tokenAddress !== undefined, retry: false },
  });
  const info = token.data && {
    symbol: token.data[0],
    decimals: token.data[1],
    balance: token.data[2],
    allowance: token.data[3],
  };

  const amount = info && parseAmount(amountInput, info.decimals);
  // datetime-local values are in the user's time zone.
  const unlockMs = new Date(unlockInput).getTime();
  const unlockTime = Number.isNaN(unlockMs) ? undefined : BigInt(Math.floor(unlockMs / 1000));
  // The contract makes the depositor the withdrawer when given the zero address.
  const withdrawer =
    withdrawerInput === "" ? zeroAddress : isAddress(withdrawerInput) ? withdrawerInput : undefined;

  const tokenMessage =
    tokenInput === ""
      ? "The ERC20 token you want to lock."
      : !tokenAddress
        ? "Enter a valid address."
        : token.isPending
          ? "Looking up token…"
          : info
            ? `Balance: ${formatUnits(info.balance, info.decimals)} ${info.symbol}`
            : isRpcError(token.error)
              ? `Couldn't look up this token: ${errorMessage(token.error)}`
              : `No ERC20 token found at this address on ${chain.name}.`;
  const tokenInvalid = (tokenInput !== "" && !tokenAddress) || token.isError;

  const amountError =
    !info || amountInput === ""
      ? undefined
      : amount === undefined
        ? `Enter a number with at most ${info.decimals} decimal places.`
        : amount === BigInt(0)
          ? "Enter an amount above 0."
          : amount > info.balance
            ? "That's more than your balance."
            : undefined;

  const ready =
    info !== undefined &&
    amount !== undefined &&
    amountError === undefined &&
    unlockTime !== undefined &&
    withdrawer !== undefined;
  const needsApproval = info !== undefined && amount !== undefined && info.allowance < amount;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !tokenAddress) return;
    setError(undefined);
    if (!isInFuture(unlockTime)) {
      setError("Pick an unlock time in the future.");
      return;
    }

    try {
      if (needsApproval) {
        setStatus("approving");
        await waitForSuccess(
          await writeContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [timeLock, amount],
            chainId: chain.id,
          }),
          chain.id,
        );
        await token.refetch();
      }

      setStatus("locking");
      const receipt = await waitForSuccess(
        await writeContract({
          address: timeLock,
          abi: timeLockAbi,
          functionName: "deposit",
          args: [tokenAddress, amount, unlockTime, withdrawer],
          chainId: chain.id,
        }),
        chain.id,
      );
      // Only TimeLock's logs: the token's transferFrom runs first and could emit a look-alike event.
      const [deposited] = parseEventLogs({
        abi: timeLockAbi,
        eventName: "Deposited",
        logs: receipt.logs.filter((log) => isAddressEqual(log.address, timeLock)),
      });
      // The event has the amount actually received, which is less than `amount` for fee-on-transfer tokens.
      setLock({
        id: deposited.args.lockId,
        token: tokenAddress,
        amount: formatUnits(deposited.args.amount, info.decimals),
        symbol: info.symbol,
        unlockTime,
        hash: receipt.transactionHash,
      });
      setAmountInput("");
      token.refetch();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStatus("idle");
    }
  }

  // Editing a field clears the error from the last submit.
  function onEdit(set: (value: string) => void) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(undefined);
      set(event.target.value.trim());
    };
  }

  if (lock) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/15 p-5">
        <h2 className="font-semibold">Tokens locked</h2>
        <p className="text-sm">
          Lock #{lock.id.toString()} holds {lock.amount} {lock.symbol} until{" "}
          {formatTime(lock.unlockTime)}. It&apos;s listed under{" "}
          <Link href="/locks" className="underline underline-offset-2">
            Your locks
          </Link>
          , and anyone can see it on the{" "}
          <Link href={`/tokens?chain=${chain.id}&token=${lock.token}`} className="underline underline-offset-2">
            {lock.symbol} token locks
          </Link>{" "}
          page.
        </p>
        <div className="flex gap-2 text-sm">
          <a
            href={`${chain.blockExplorers.default.url}/tx/${lock.hash}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-full border border-foreground/15 px-4 py-2 text-center hover:bg-foreground/5"
          >
            View transaction
          </a>
          <button
            type="button"
            onClick={() => setLock(undefined)}
            className="flex-1 rounded-full border border-foreground/15 px-4 py-2 hover:bg-foreground/5"
          >
            Lock more
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field id="token" label="Token contract address" message={tokenMessage} invalid={tokenInvalid}>
        <input
          id="token"
          value={tokenInput}
          onChange={onEdit(setTokenInput)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={tokenInvalid}
          aria-describedby="token-message"
          className={`${inputClass} font-mono`}
        />
      </Field>

      <Field id="amount" label="Amount" message={amountError} invalid={amountError !== undefined}>
        <div className="flex gap-2">
          <input
            id="amount"
            value={amountInput}
            onChange={onEdit(setAmountInput)}
            placeholder="0.0"
            inputMode="decimal"
            autoComplete="off"
            disabled={!info}
            aria-invalid={amountError !== undefined}
            aria-describedby="amount-message"
            className={inputClass}
          />
          <button
            type="button"
            disabled={!info}
            onClick={() => {
              if (!info) return;
              setError(undefined);
              setAmountInput(formatUnits(info.balance, info.decimals));
            }}
            className="rounded-xl border border-foreground/15 px-4 text-sm hover:bg-foreground/5 disabled:opacity-50"
          >
            Max
          </button>
        </div>
      </Field>

      <Field
        id="unlock-time"
        label="Unlock time"
        message="In your local time. It can't be changed after locking. Robinhood Chain's block clock can run up to an hour ahead, so tokens may unlock up to an hour early."
      >
        <input
          id="unlock-time"
          type="datetime-local"
          value={unlockInput}
          onChange={onEdit(setUnlockInput)}
          aria-describedby="unlock-time-message"
          className={`${inputClass} scheme-light-dark`}
        />
      </Field>

      <Field
        id="withdrawer"
        label="Withdrawer (optional)"
        message={withdrawer === undefined ? "Enter a valid address." : "Who can withdraw the tokens. Leave empty for yourself."}
        invalid={withdrawer === undefined}
      >
        <input
          id="withdrawer"
          value={withdrawerInput}
          onChange={onEdit(setWithdrawerInput)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={withdrawer === undefined}
          aria-describedby="withdrawer-message"
          className={`${inputClass} font-mono`}
        />
      </Field>

      {ready && (
        <p className="text-sm text-foreground/70">
          {amountInput} {info.symbol} will be locked until {formatTime(unlockTime)}.
          {needsApproval && ` Your wallet will ask you to approve ${info.symbol}, then to lock it.`}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || status !== "idle"}
        className="rounded-full bg-foreground px-4 py-3 font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {status === "approving"
          ? `Approving ${info?.symbol}…`
          : status === "locking"
            ? "Locking…"
            : needsApproval
              ? `Approve and lock ${info.symbol}`
              : `Lock ${info?.symbol ?? "tokens"}`}
      </button>
      {status !== "idle" && (
        <p className="text-sm text-foreground/70">Confirm in your wallet, then wait for the transaction to land.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 outline-none focus:border-foreground/40 disabled:opacity-50 aria-invalid:border-red-600 dark:aria-invalid:border-red-400";

function Field({
  id,
  label,
  message,
  invalid = false,
  children,
}: {
  id: string;
  label: string;
  message?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {message && (
        <p
          id={`${id}-message`}
          className={`text-sm ${invalid ? "text-red-600 dark:text-red-400" : "text-foreground/60"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

// Parses a decimal string into token units, or undefined if it isn't a plain number with at most
// `decimals` decimal places.
function parseAmount(value: string, decimals: number) {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(value);
  if (!match || (match[1] === "" && !match[2]) || (match[2] ?? "").length > decimals) return undefined;
  return parseUnits(value, decimals);
}

function isInFuture(unixSeconds: bigint) {
  return unixSeconds * BigInt(1000) > BigInt(Date.now());
}
