import { BaseError, HttpRequestError, RpcRequestError, TimeoutError } from "viem";

// viem and wagmi errors put details and a version footer in `message`; `shortMessage` is the readable part.
export function errorMessage(error: Error) {
  return "shortMessage" in error && typeof error.shortMessage === "string"
    ? error.shortMessage
    : error.message;
}

// Whether a request failed on its way to or from the node (network, HTTP status, timeout or a
// JSON-RPC error), as opposed to the contract reverting or returning something unexpected.
export function isRpcError(error: unknown): error is BaseError {
  return (
    error instanceof BaseError &&
    error.walk(
      (e) => e instanceof HttpRequestError || e instanceof RpcRequestError || e instanceof TimeoutError,
    ) !== null
  );
}
