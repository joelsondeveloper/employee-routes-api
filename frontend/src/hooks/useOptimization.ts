import {useCallback, useRef, useState} from "react";
import {api, ApiError} from "../services/api";
import type {OptimizationResponse} from "../types/api";

export type OptimizationState =
  | {status: "idle"; result?: undefined; error?: undefined}
  | {status: "loading"; result?: OptimizationResponse; employeeCount: number; error?: undefined}
  | {status: "success"; result: OptimizationResponse; error?: undefined}
  | {status: "error"; result?: OptimizationResponse; error: ApiError | Error};

export type OptimizationMode = "normal" | "demo";

export function useOptimization() {
  const [state, setState] = useState<OptimizationState>({status: "idle"});
  const running = useRef(false);

  const optimize = useCallback(async (employeeIds: string[], mode: OptimizationMode = "normal") => {
    if (running.current) return undefined;
    running.current = true;
    setState((previous) => ({status: "loading", result: previous.result, employeeCount: employeeIds.length}));
    try {
      const result = mode === "demo"
        ? await api.optimizeDemoRoutes(employeeIds)
        : await api.optimizeRoutes(employeeIds);
      setState({status: "success", result});
      return result;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Não foi possível calcular as rotas.");
      setState((previous) => ({status: "error", result: previous.result, error: normalized}));
      return undefined;
    } finally {
      running.current = false;
    }
  }, []);

  const applyResult = useCallback((result: OptimizationResponse) => {
    setState({status: "success", result});
  }, []);

  const reset = useCallback(() => {
    if (!running.current) setState({status: "idle"});
  }, []);

  return {state, optimize, applyResult, reset};
}
