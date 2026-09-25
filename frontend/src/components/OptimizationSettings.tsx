import {useState} from "react";
import type {OptimizationConfigInput, OptimizationProfile, OptimizationRequestConfig} from "../types/api";

const DEFAULT_CUSTOM: OptimizationConfigInput = {
  minimumCompatibilityScore: 35,
  maxDirectionDifference: 90,
  maxProximityKm: 10,
  maxDistanceDifferenceKm: 20,
  maxAverageExtraDurationMinutes: 20,
  maxExtraDurationMinutes: 30,
};

export function defaultOptimizationRequest(): OptimizationRequestConfig {
  return {optimizationProfile: "NORMAL"};
}

export function optimizationConfigError(value: OptimizationRequestConfig): string | undefined {
  if (value.optimizationProfile !== "CUSTOM" || !value.optimizationConfig) return undefined;
  const c = value.optimizationConfig;
  if (![c.minimumCompatibilityScore, c.maxDirectionDifference, c.maxProximityKm, c.maxDistanceDifferenceKm, c.maxAverageExtraDurationMinutes, c.maxExtraDurationMinutes].every(Number.isFinite)) return "Preencha todos os valores da configuração personalizada.";
  if (c.maxExtraDurationMinutes < c.maxAverageExtraDurationMinutes) return "O maior desvio deve ser igual ou maior que o desvio médio.";
  if (c.minimumCompatibilityScore < 0 || c.minimumCompatibilityScore > 100 || c.maxDirectionDifference < 10 || c.maxDirectionDifference > 180 || c.maxProximityKm < 1 || c.maxProximityKm > 30 || c.maxDistanceDifferenceKm < 1 || c.maxDistanceDifferenceKm > 50 || c.maxAverageExtraDurationMinutes < 5 || c.maxAverageExtraDurationMinutes > 60 || c.maxExtraDurationMinutes < 5 || c.maxExtraDurationMinutes > 90) return "Revise os limites permitidos para a configuração personalizada.";
  return undefined;
}

export function OptimizationSettings({value, onChange, disabled = false}: {value: OptimizationRequestConfig; onChange: (value: OptimizationRequestConfig) => void; disabled?: boolean}) {
  const [custom, setCustom] = useState<OptimizationConfigInput>(value.optimizationConfig ?? DEFAULT_CUSTOM);
  const updateProfile = (optimizationProfile: OptimizationProfile) => {
    if (optimizationProfile === "CUSTOM") onChange({optimizationProfile, optimizationConfig: custom});
    else onChange({optimizationProfile});
  };
  const updateCustom = (key: keyof OptimizationConfigInput, raw: string) => {
    const next = {...custom, [key]: Number(raw)};
    setCustom(next);
    onChange({optimizationProfile: "CUSTOM", optimizationConfig: next});
  };
  return <section className="optimization-settings" aria-labelledby="optimization-settings-title">
    <div className="optimization-settings-heading"><div><h2 id="optimization-settings-title" className="section-title">Perfil da otimização</h2><p className="section-note">Escolha quão conservadora deve ser a formação dos grupos nesta execução.</p></div></div>
    <div className="optimization-profile-options" role="radiogroup" aria-label="Perfil da otimização">
      <label className="optimization-profile-option"><input type="radio" name="optimization-profile" checked={value.optimizationProfile === "NORMAL"} disabled={disabled} onChange={() => updateProfile("NORMAL")} /><span><strong>Normal</strong><small>Configuração atual validada.</small></span></label>
      <label className="optimization-profile-option"><input type="radio" name="optimization-profile" checked={value.optimizationProfile === "CONSERVATIVE"} disabled={disabled} onChange={() => updateProfile("CONSERVATIVE")} /><span><strong>Conservador <em>Experimental</em></strong><small>Usa limites mais restritivos para formar grupos.</small></span></label>
      <label className="optimization-profile-option"><input type="radio" name="optimization-profile" checked={value.optimizationProfile === "CUSTOM"} disabled={disabled} onChange={() => updateProfile("CUSTOM")} /><span><strong>Personalizado</strong><small>Defina os limites desta execução.</small></span></label>
    </div>
    {value.optimizationProfile === "CUSTOM" && <div className="optimization-custom-grid">
      {([ ["minimumCompatibilityScore", "Score mínimo", 0, 100, ""], ["maxDirectionDifference", "Direção máxima", 10, 180, "°"], ["maxProximityKm", "Proximidade máxima", 1, 30, "km"], ["maxDistanceDifferenceKm", "Diferença de distância", 1, 50, "km"], ["maxAverageExtraDurationMinutes", "Desvio médio máximo", 5, 60, "min"], ["maxExtraDurationMinutes", "Maior desvio máximo", 5, 90, "min"]] as const).map(([key, label, min, max, suffix]) => <label className="form-field" key={key}><span className="form-label">{label}{suffix ? ` (${suffix})` : ""}</span><input className="form-input" type="number" min={min} max={max} step="any" value={custom[key]} disabled={disabled} onChange={(event) => updateCustom(key, event.target.value)} /></label>)}
      <div className="optimization-custom-actions"><button type="button" className="button button-quiet" disabled={disabled} onClick={() => {setCustom(DEFAULT_CUSTOM); onChange({optimizationProfile: "NORMAL"});}}>Restaurar Normal</button><span className="section-note">O maior desvio deve ser igual ou maior que o desvio médio.</span></div>
      {optimizationConfigError(value) && <p className="form-error" role="alert">{optimizationConfigError(value)}</p>}
    </div>}
  </section>;
}
