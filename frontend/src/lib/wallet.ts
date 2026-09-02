import { useCallback, useState } from "react";
import {
  createWalletClient,
  custom,
  type Address,
  type WalletClient,
} from "viem";
import { account, chain, chainId, isLocal, rpcUrl, walletClient } from "./clients";

export type Signer = { owner: Address; wc: WalletClient };

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): Eip1193 | undefined {
  return (globalThis as unknown as { ethereum?: Eip1193 }).ethereum;
}

/**
 * Provides the active signer. On local Anvil this is the built-in dev account;
 * on live chains (Unichain) it is a connected browser wallet.
 */
export function useSigner() {
  const [injected, setInjected] = useState<Signer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localSigner: Signer | null = isLocal
    ? { owner: account.address, wc: walletClient }
    : null;
  const signer = localSigner ?? injected;

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setError("No browser wallet found. Install MetaMask.");
      return;
    }
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      const wantHex = `0x${chainId.toString(16)}`;
      const current = (await eth.request({ method: "eth_chainId" })) as string;
      if (current !== wantHex) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: wantHex }],
          });
        } catch (switchErr) {
          // 4902 = chain not added to the wallet yet. Add it, then retry.
          const code = (switchErr as { code?: number })?.code;
          if (code === 4902 || code === -32603) {
            try {
              await eth.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: wantHex,
                    chainName: chain.name,
                    nativeCurrency: chain.nativeCurrency,
                    rpcUrls: [rpcUrl || chain.rpcUrls.default.http[0]],
                    blockExplorerUrls: chain.blockExplorers?.default
                      ? [chain.blockExplorers.default.url]
                      : [],
                  },
                ],
              });
            } catch {
              setError(`Add ${chain.name} (chain ${chainId}) to your wallet to continue.`);
              return;
            }
          } else {
            setError(`Switch your wallet to ${chain.name} (chain ${chainId}).`);
            return;
          }
        }
      }
      const owner = accounts[0] as Address;
      const wc = createWalletClient({ account: owner, chain, transport: custom(eth) });
      setInjected({ owner, wc });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const disconnect = useCallback(() => setInjected(null), []);

  return {
    signer,
    connect,
    disconnect,
    error,
    needsConnect: !isLocal && !injected,
  };
}
