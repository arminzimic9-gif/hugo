import RAW_ARENA_CONTRACTS from "@/data/arena-contracts.json";

export type ArenaContractKind = "kills" | "no-damage" | "cores" | "elite" | "defense";

export type ArenaContractDefinition = {
  id: string;
  label: string;
  description: string;
  kind: ArenaContractKind;
  target: number;
  durationSeconds: number;
  rewardLabel: string;
};

export const ARENA_CONTRACTS = RAW_ARENA_CONTRACTS as ArenaContractDefinition[];

export const ARENA_CONTRACTS_BY_ID = Object.fromEntries(
  ARENA_CONTRACTS.map((contract) => [contract.id, contract])
) as Record<string, ArenaContractDefinition>;
