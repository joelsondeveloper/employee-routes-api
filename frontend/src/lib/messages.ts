export const apiErrorMessages: Record<string, string> = {
  INVALID_REQUEST: "Confira os dados enviados e tente novamente.",
  INVALID_JSON: "A requisição não pôde ser lida. Tente novamente.",
  INVALID_ROUTING_INPUT: "Há dados de localização inválidos cadastrados.",
  ROUTING_PROVIDER_CONFIGURATION: "O serviço de rotas não está configurado.",
  ROUTING_PROVIDER_RESPONSE_INVALID: "O serviço de rotas devolveu uma resposta inválida.",
  ROUTE_UNAVAILABLE: "Não foi possível encontrar uma rota para esta combinação.",
  ROUTING_PROVIDER_UNAVAILABLE: "O serviço de rotas está temporariamente indisponível.",
  ROUTING_PROVIDER_TIMEOUT: "O serviço de rotas demorou mais que o esperado.",
  NETWORK_ERROR: "Não foi possível conectar ao backend.",
  INVALID_RESPONSE: "Não foi possível ler a resposta do servidor. Tente novamente.",
  ADDRESS_NOT_FOUND: "Não encontramos esse endereço. Inclua rua, número, bairro e cidade.",
  GEOCODING_UNAVAILABLE: "O serviço de localização está temporariamente indisponível. Tente novamente.",
  EMPLOYEE_NOT_FOUND: "Este funcionário não está mais cadastrado. Atualize a lista.",
  INVALID_EMPLOYEE: "Preencha nome, telefone e endereço.",
  GEOCODING_NOT_FOUND: "Não encontramos esse endereço. Revise o endereço e tente novamente.",
  GEOCODING_PROVIDER_UNAVAILABLE: "O serviço de localização está temporariamente indisponível.",
  INVALID_GEOCODING_INPUT: "Informe um endereço para localizar.",
  INTERNAL_ERROR: "Ocorreu um erro inesperado no servidor.",
};

export function friendlyApiError(code?: string, fallback = "Não foi possível concluir a operação."): string {
  return (code && apiErrorMessages[code]) || fallback;
}

export function friendlyViolation(type: string, employeeName: string, actualValue: number, limit: number): string {
  if (type === "MAX_EXTRA_DURATION") {
    return `${employeeName} terá ${Math.round(actualValue / 60)} min de desvio. Limite configurado: ${Math.round(limit / 60)} min.`;
  }
  return `${employeeName} possui uma restrição que precisa ser revisada.`;
}
