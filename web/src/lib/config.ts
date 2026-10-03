/** Live QuietSwitch deploy on GenLayer Studio Dev (chain 61997). Override via env. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_QUIETSWITCH_ADDRESS ||
  "0x7ACfde1Bb69023B903d599495719ad6736e5f21e") as `0x${string}`;

/** Studio Dev / Studio Next — chain ID 61997. */
export const CHAIN_ID = 61997;
export const RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-dev.genlayer.com/api";
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || "https://explorer-studio-dev.genlayer.com";
export const EXPLORER = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
export const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

export const GITHUB = "https://github.com/valentinzubok/QuietSwitch";
export const CONTRACT_REPO = "https://github.com/valentinzubok/QuietSwitchCore";

/** The demo heartbeat pages live in this repository, so every change is a public commit. */
export const DEMO_HEARTBEAT =
  "https://valentinzubok.github.io/QuietSwitch/fixtures/heartbeat.html";
export const DEMO_STALE = "https://valentinzubok.github.io/QuietSwitch/fixtures/stale.html";
export const DEMO_RULE =
  "The page must state a check-in dated no earlier than September 2026.";
/** Seconds per observation window: one counted miss per window, at most. */
export const DEFAULT_INTERVAL = "86400";

export const DEMO_NOTE =
  "Rotate the signing key with runbook 7; the recovery shard is with the notary.";
