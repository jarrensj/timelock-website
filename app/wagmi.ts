import { createConfig, http } from "wagmi";
import { robinhood, robinhoodTestnet } from "wagmi/chains";

// No connectors are listed: wagmi discovers installed browser wallets through EIP-6963.
// TODO: add the walletConnect connector so mobile wallets can connect outside their in-app
// browser. It needs a Reown project ID set as an env var.
export const config = createConfig({
  chains: [robinhood, robinhoodTestnet],
  ssr: true,
  transports: {
    [robinhood.id]: http(),
    [robinhoodTestnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
