"use client";

import { useId, useState } from "react";
import { type Address, isAddress, isAddressEqual, zeroAddress } from "viem";
import { useWriteContract } from "wagmi";
import { errorMessage } from "../errors";
import { timeLockAbi } from "../timelock";
import { waitForSuccess } from "../transactions";
import type { Chain } from "../wagmi";
import type { Lock } from "./use-locks";

// The depositor or the current withdrawer can change a lock's withdrawer until it's withdrawn.
export function ChangeWithdrawer({
  lock,
  account,
  chain,
  timeLock,
  onChanged,
}: {
  lock: Lock;
  account: Address;
  chain: Chain;
  timeLock: Address;
  onChanged: () => Promise<unknown>;
}) {
  const id = useId();
  const { mutateAsync: writeContract } = useWriteContract();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-foreground/70 underline underline-offset-2 hover:text-foreground"
      >
        Change withdrawer
      </button>
    );
  }

  const newWithdrawer = isAddress(input) ? input : undefined;
  const inputError =
    input === ""
      ? undefined
      : !newWithdrawer
        ? "Enter a valid address."
        : isAddressEqual(newWithdrawer, zeroAddress)
          ? "The withdrawer can't be the zero address."
          : isAddressEqual(newWithdrawer, lock.withdrawer)
            ? "That's already the withdrawer."
            : undefined;
  const hint = isAddressEqual(lock.depositor, account)
    ? "Only the new withdrawer will be able to withdraw. As the depositor, you can change it again until it's withdrawn."
    : "Only the new withdrawer will be able to withdraw. You won't be able to withdraw or change this lock afterwards.";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newWithdrawer || inputError) return;
    setError(undefined);
    setSaving(true);
    try {
      await waitForSuccess(
        await writeContract({
          address: timeLock,
          abi: timeLockAbi,
          functionName: "updateWithdrawer",
          args: [lock.id, newWithdrawer],
          chainId: chain.id,
        }),
        chain.id,
      );
      await onChanged();
      setOpen(false);
      setInput("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
      <label htmlFor={id} className="text-sm font-medium">
        New withdrawer
      </label>
      <input
        id={id}
        value={input}
        onChange={(event) => {
          setError(undefined);
          setInput(event.target.value.trim());
        }}
        placeholder="0x…"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={inputError !== undefined}
        aria-describedby={`${id}-message`}
        className="w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-foreground/40 aria-invalid:border-red-600 dark:aria-invalid:border-red-400"
      />
      <p
        id={`${id}-message`}
        className={`text-sm ${inputError ? "text-red-600 dark:text-red-400" : "text-foreground/60"}`}
      >
        {inputError ?? hint}
      </p>
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setInput("");
            setError(undefined);
          }}
          disabled={saving}
          className="flex-1 rounded-full border border-foreground/15 px-4 py-2 hover:bg-foreground/5 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!newWithdrawer || inputError !== undefined || saving}
          className="flex-1 rounded-full bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {saving && (
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
