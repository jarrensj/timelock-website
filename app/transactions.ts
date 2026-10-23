import type { Hash } from "viem";
import { waitForTransactionReceipt } from "wagmi/actions";
import { type Chain, config } from "./wagmi";

// Waits for a transaction to land and throws if it reverted.
export async function waitForSuccess(hash: Hash, chainId: Chain["id"]) {
  const receipt = await waitForTransactionReceipt(config, { hash, chainId });
  if (receipt.status === "reverted") throw new Error("The transaction reverted.");
  return receipt;
}
