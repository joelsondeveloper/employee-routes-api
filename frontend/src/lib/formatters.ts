const numberFormat = new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 1});

export function formatDuration(seconds: number): string {
  const minutes = seconds / 60;
  return `${numberFormat.format(minutes)} min`;
}

export function formatDistance(meters: number): string {
  return `${numberFormat.format(meters / 1000)} km`;
}

export function formatExtraDuration(seconds: number): string {
  if (seconds <= 0) return "Sem desvio";
  return `${numberFormat.format(seconds / 60)} min de desvio`;
}

export function formatPhone(phone: string): string {
  return phone.trim() || "Não informado";
}

export function formatElapsed(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}min ${String(remainingSeconds).padStart(2, "0")}s`;
}
