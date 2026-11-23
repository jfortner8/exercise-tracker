import { useQuery } from "@tanstack/react-query";
import type { BenchmarksResponse, DayWorkoutsResponse, MeResponse } from "@et/core/api-types";
import { api } from "./client";

/** Who's signed in, their settings, which optional tabs to show, and today where the phone is. */
export const useMe = (enabled = true) => useQuery({ queryKey: ["me"], queryFn: () => api<MeResponse>("/me"), enabled });

export const useDayWorkouts = (date: string | undefined) =>
  useQuery({
    queryKey: ["day", date, "workouts"],
    queryFn: () => api<DayWorkoutsResponse>(`/days/${date}/workouts`),
    enabled: !!date,
  });

/** Everything tracked and every result (PBs are worked out from them). */
export const useBenchmarks = () => useQuery({ queryKey: ["benchmarks"], queryFn: () => api<BenchmarksResponse>("/benchmarks") });
