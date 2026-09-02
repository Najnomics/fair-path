#!/usr/bin/env bash
# Deploy FairFlow to Unichain Sepolia (default) or Unichain mainnet.
#
#   ./scripts/deploy-unichain.sh                 # -> unichain_sepolia (1301)
#   ./scripts/deploy-unichain.sh unichain        # -> unichain mainnet (130)
#   VERIFY=1 ./scripts/deploy-unichain.sh        # also verify on Uniscan
#
# Requires a .env with PRIVATE_KEY and the matching *_RPC_URL (see .env.example).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

: "${PRIVATE_KEY:?set PRIVATE_KEY in .env}"

NETWORK="${1:-unichain_sepolia}"
case "$NETWORK" in
  unichain_sepolia) : "${UNICHAIN_SEPOLIA_RPC_URL:?set UNICHAIN_SEPOLIA_RPC_URL in .env}" ;;
  unichain)         : "${UNICHAIN_RPC_URL:?set UNICHAIN_RPC_URL in .env}" ;;
  *) echo "unknown network '$NETWORK' (use unichain_sepolia or unichain)"; exit 1 ;;
esac

VERIFY_FLAG=""
if [ "${VERIFY:-0}" = "1" ]; then
  : "${ETHERSCAN_API_KEY:?set ETHERSCAN_API_KEY to verify}"
  VERIFY_FLAG="--verify"
fi

echo "Deploying Fair Path → ${NETWORK}"
forge script script/DeployUnichain.s.sol:DeployUnichainScript \
  --rpc-url "$NETWORK" \
  --broadcast \
  --code-size-limit 40000 \
  ${VERIFY_FLAG} \
  -vvv

echo
echo "Manifest written to frontend/src/deployed.json (and deployed.<chainId>.json)."
echo "Build the console for the live chain:"
echo "  cd frontend && VITE_RPC_URL=\"\$UNICHAIN_SEPOLIA_RPC_URL\" npm run build"
