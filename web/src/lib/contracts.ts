import { CONTRACT_ADDRESS } from "./config";
import { type Address, type TxStage, parseJson, readContract, writeAndWait } from "./genlayer";

export type SwitchRow = {
  switch_id: string;
  holder: string;
  successor: string;
  heartbeat_url: string;
  rule: string;
  note: string;
  status: string;
  misses: number;
  misses_required: number;
  checks: number;
  last_result: string;
  last_page_hash: string;
  last_detail: string;
  injection_flags: string[];
  fired_to: string;
};

export type EventRow = { kind: string; [key: string]: unknown };

export type Stats = {
  switches: number;
  armed: number;
  fired: number;
  disarmed: number;
  pending_misses: number;
  checks: number;
};

export async function listIds(): Promise<string[]> {
  return parseJson<string[]>(await readContract<string>(CONTRACT_ADDRESS, "list_ids", []), []);
}

export async function getSwitch(id: string): Promise<SwitchRow | null> {
  const raw = await readContract<string>(CONTRACT_ADDRESS, "get_switch", [id]);
  const parsed = parseJson<SwitchRow & { error?: string }>(raw, {} as SwitchRow);
  return parsed.switch_id ? parsed : null;
}

export async function getEvents(): Promise<EventRow[]> {
  return parseJson<EventRow[]>(
    await readContract<string>(CONTRACT_ADDRESS, "get_events", []),
    [],
  );
}

export async function getStats(): Promise<Stats | null> {
  return parseJson<Stats | null>(
    await readContract<string>(CONTRACT_ADDRESS, "get_stats", []),
    null,
  );
}

export async function getOwner(): Promise<string> {
  return (await readContract<string>(CONTRACT_ADDRESS, "get_owner", [])) || "";
}

export async function arm(
  account: Address,
  provider: unknown,
  switchId: string,
  heartbeatUrl: string,
  rule: string,
  successor: string,
  note: string,
  missesRequired: string,
  onStage?: (stage: TxStage, hash: string) => void,
) {
  return writeAndWait(
    account,
    provider,
    CONTRACT_ADDRESS,
    "arm",
    [switchId, heartbeatUrl, rule, successor, note, missesRequired],
    onStage,
  );
}

export async function check(
  account: Address,
  provider: unknown,
  switchId: string,
  onStage?: (stage: TxStage, hash: string) => void,
) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "check", [switchId], onStage);
}

export async function disarm(
  account: Address,
  provider: unknown,
  switchId: string,
  onStage?: (stage: TxStage, hash: string) => void,
) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "disarm", [switchId], onStage);
}

export async function rearm(
  account: Address,
  provider: unknown,
  switchId: string,
  onStage?: (stage: TxStage, hash: string) => void,
) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "rearm", [switchId], onStage);
}
