import { type Address, formatUnits, isAddressEqual } from "viem";
import { formatTime, shortAddress } from "../format";
import type { Chain } from "../wagmi";
import type { Lock } from "./use-locks";

// undefined while loading, null if the token's symbol or decimals couldn't be read.
export type Token = { symbol: string; decimals: number } | null | undefined;

const statusClass = {
  Unlocked: "bg-green-600/15 text-green-700 dark:text-green-400",
  Locked: "bg-foreground/10 text-foreground/70",
  Withdrawn: "bg-foreground/5 text-foreground/50",
};

// A lock's amount, token, status, unlock time, withdrawer and depositor. Addresses matching
// `account` show as "You".
export function LockDetails({
  lock,
  token,
  chain,
  account,
}: {
  lock: Lock;
  token: Token;
  chain: Chain;
  account?: Address;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{formatAmount(lock.amount, token)}</p>
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
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass[lock.status]}`}>
          {lock.status}
        </span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-foreground/60">{lock.status === "Locked" ? "Unlocks" : "Unlocked"}</dt>
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
    </>
  );
}

export function formatAmount(amount: bigint, token: Token) {
  if (token === undefined) return "…";
  return token ? `${formatUnits(amount, token.decimals)} ${token.symbol}` : `${amount} units`;
}

function AddressOrYou({ address, account }: { address: Address; account?: Address }) {
  if (account && isAddressEqual(address, account)) return "You";
  return <span className="font-mono">{shortAddress(address)}</span>;
}
