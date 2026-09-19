import { SearchQuery, SearchResponse } from "@/contracts";
import { apiFetch } from "./api-client";

export const searchService = {
  search: (query: SearchQuery, signal?: AbortSignal) => apiFetch({ path: "/search", query, schema: SearchResponse, signal }),
};
