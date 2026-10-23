import { type Address, isAddress, parseAbi } from "viem";
import { robinhood, robinhoodTestnet } from "wagmi/chains";

// The parts of the TimeLock ABI this app uses, from src/TimeLock.sol in
// https://github.com/jarrensj/time-lock-contract.
export const timeLockAbi = parseAbi([
  "function deposit(address token, uint256 amount, uint256 unlockTime, address withdrawer) returns (uint256 lockId)",
  "event Deposited(uint256 indexed lockId, address indexed token, address indexed withdrawer, address depositor, uint256 amount, uint256 unlockTime)",
  "error ZeroAmount()",
  "error NotERC20()",
  "error UnlockTimeNotInFuture(uint256 unlockTime, uint256 currentTime)",
  "error TransferFailed()",
  "error Reentrancy()",
]);

// Where TimeLock is deployed on each chain; unset until it's deployed there.
export const timeLockAddresses: Partial<Record<number, Address>> = {
  [robinhood.id]: envAddress(process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS_ROBINHOOD),
  [robinhoodTestnet.id]: envAddress(process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS_ROBINHOOD_TESTNET),
};

function envAddress(value: string | undefined) {
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error(`Invalid TimeLock address: ${value}`);
  return value;
}
