import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, AlertTriangle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";

export function ConnectPrompt() {
  const { isWrongNetwork } = useWallet();

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-5">
        {isWrongNetwork
          ? <AlertTriangle className="w-7 h-7 text-yellow-400" />
          : <Wallet className="w-7 h-7 text-primary" />}
      </div>

      <h2 className="text-lg font-bold mb-2">
        {isWrongNetwork ? "Wrong Network" : "Connect your wallet"}
      </h2>

      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {isWrongNetwork
          ? "Please switch to Ethereum Sepolia to use this page."
          : "You need to connect a wallet to view this page."}
      </p>

      <ConnectButton />
    </div>
  );
}
