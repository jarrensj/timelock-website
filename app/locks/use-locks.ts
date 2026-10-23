import type { Address } from "viem";
import { useBlock, useReadContract, useReadContracts } from "wagmi";
import { timeLockAbi } from "../timelock";
import type { Chain } from "../wagmi";

export type Lock = {
  id: bigint;
  token: Address;
  depositor: Address;
  withdrawer: Address;
  amount: bigint;
  unlockTime: bigint;
  withdrawn: boolean;
  status: "Locked" | "Unlocked" | "Withdrawn";
};

const rank = { Unlocked: 0, Locked: 1, Withdrawn: 2 };

// Every lock in TimeLock, sorted unlocked first, then locked by when they unlock, then withdrawn.
// `locks` is undefined until they've loaded.
export function useLocks(chainId: Chain["id"], timeLock: Address) {
  const count = useReadContract({ address: timeLock, abi: timeLockAbi, functionName: "lockCount", chainId });
  // TODO: this reads every lock, and callers filter for the ones they show. Once there are too
  // many for that, find them through the Deposited and WithdrawerUpdated logs or an indexer instead.
  const all = useReadContracts({
    allowFailure: false,
    chainId,
    contracts: Array.from(
      { length: Number(count.data ?? 0) },
      (_, id) => ({ address: timeLock, abi: timeLockAbi, functionName: "getLock", args: [BigInt(id)] }) as const,
    ),
    query: { enabled: count.data !== undefined },
  });
  // The contract compares unlock times with the block timestamp, which can run ahead of real time.
  const block = useBlock({ chainId, query: { refetchInterval: 30_000 } });
  const chainTime = block.data?.timestamp;

  const locks = all.data
    ?.map(
      (lock, id): Lock => ({
        ...lock,
        id: BigInt(id),
        status: lock.withdrawn
          ? "Withdrawn"
          : chainTime !== undefined && chainTime >= lock.unlockTime
            ? "Unlocked"
            : "Locked",
      }),
    )
    .sort((a, b) => rank[a.status] - rank[b.status] || Number(a.unlockTime - b.unlockTime));

  return { locks, error: count.error ?? all.error, refetch: all.refetch };
}
