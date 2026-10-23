"use client";

import type { Address } from "viem";
import {
  useChains,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { errorMessage } from "./errors";

export function ConnectWallet() {
  const { address, chain } = useConnection();

  if (address) return <Connected address={address} chainId={chain?.id} />;
  return <ConnectButton />;
}

function ConnectButton() {
  const connectors = useConnectors();
  const connect = useConnect();

  return (
    <>
      <button
        type="button"
        popoverTarget="connect-wallet"
        className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Connect wallet
      </button>
      {/* Unmounts once a wallet connects, which also closes it. */}
      <div
        id="connect-wallet"
        popover="auto"
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-foreground/15 bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <h2 className="mb-4 font-semibold">Connect a wallet</h2>
        {connectors.length === 0 ? (
          <p className="text-sm text-foreground/70">
            No browser wallet found. Install one, such as MetaMask or Rabby, then reload this page.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {connectors.map((connector) => (
              <li key={connector.uid}>
                <button
                  type="button"
                  disabled={connect.isPending}
                  onClick={() => connect.mutate({ connector })}
                  className="flex w-full items-center gap-3 rounded-xl border border-foreground/15 px-4 py-3 text-left hover:bg-foreground/5 disabled:opacity-50"
                >
                  {connector.icon && (
                    // eslint-disable-next-line @next/next/no-img-element -- EIP-6963 wallet icons are data URIs, which next/image can't optimize.
                    <img src={connector.icon} alt="" width={24} height={24} />
                  )}
                  {connector.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {connect.isPending && (
          <p className="mt-4 text-sm text-foreground/70">Confirm the connection in your wallet.</p>
        )}
        {connect.error && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {errorMessage(connect.error)}
          </p>
        )}
      </div>
    </>
  );
}

function Connected({ address, chainId }: { address: Address; chainId: number | undefined }) {
  const chains = useChains();
  const switchChain = useSwitchChain();
  const disconnect = useDisconnect();
  const explorer = chains.find((c) => c.id === chainId)?.blockExplorers.default;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 text-sm">
        <select
          aria-label="Network"
          value={chainId ?? ""}
          disabled={switchChain.isPending}
          onChange={(event) => {
            const chain = chains.find((c) => c.id === Number(event.target.value));
            if (chain) switchChain.mutate({ chainId: chain.id });
          }}
          className={`rounded-full border bg-background px-3 py-1.5 ${
            chainId === undefined
              ? "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
              : "border-foreground/15"
          }`}
        >
          {chainId === undefined && (
            <option value="" disabled>
              Unsupported network
            </option>
          )}
          {chains.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          popoverTarget="wallet-menu"
          className="rounded-full border border-foreground/15 px-3 py-1.5 font-mono hover:bg-foreground/5"
        >
          {address.slice(0, 6)}…{address.slice(-4)}
        </button>
      </div>
      {/* Unmounts on disconnect, which also closes it. */}
      <div
        id="wallet-menu"
        popover="auto"
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-foreground/15 bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <h2 className="mb-2 font-semibold">Connected wallet</h2>
        <p className="mb-4 font-mono text-sm break-all">{address}</p>
        <div className="flex gap-2 text-sm">
          {explorer && (
            <a
              href={`${explorer.url}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-full border border-foreground/15 px-4 py-2 text-center hover:bg-foreground/5"
            >
              View on {explorer.name}
            </a>
          )}
          <button
            type="button"
            onClick={() => disconnect.mutate()}
            className="flex-1 rounded-full border border-foreground/15 px-4 py-2 hover:bg-foreground/5"
          >
            Disconnect
          </button>
        </div>
      </div>
      {switchChain.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage(switchChain.error)}
        </p>
      )}
    </div>
  );
}
