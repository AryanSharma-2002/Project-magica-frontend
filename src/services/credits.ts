import { BalanceResponse, CursorQuery, ListLedgerResponse } from "@/contracts";
import { apiFetch } from "./api-client";

export const creditsService = {
  balance: (signal?: AbortSignal) => apiFetch({ path: "/credits/balance", schema: BalanceResponse, signal }),
  ledger: (query: CursorQuery, signal?: AbortSignal) => apiFetch({ path: "/credits/ledger", query, schema: ListLedgerResponse, signal }),
};
