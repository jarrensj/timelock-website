// viem and wagmi errors put details and a version footer in `message`; `shortMessage` is the readable part.
export function errorMessage(error: Error) {
  return "shortMessage" in error && typeof error.shortMessage === "string"
    ? error.shortMessage
    : error.message;
}
