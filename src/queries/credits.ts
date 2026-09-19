"use client";
import { useQuery } from "@tanstack/react-query";
import { creditsService } from "@/services";
import { qk } from "./keys";

export function useBalance() {
  return useQuery({
    queryKey: qk.balance,
    queryFn: ({ signal }) => creditsService.balance(signal),
  });
}
