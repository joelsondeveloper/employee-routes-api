import {Router, type Request, type Response} from "express";
import {geocodeAddress} from "./geocoding.service.js";
import {GeocodingNotFoundError, GeocodingProviderError} from "./geocoding.errors.js";
import {logExternalProviderFailure} from "../external-provider.logging.js";

export interface GeocodingRouteDependencies {
  geocode?: typeof geocodeAddress;
}

export function createGeocodingRouter(dependencies: GeocodingRouteDependencies = {}): Router {
  const router = Router();
  const geocode = dependencies.geocode ?? geocodeAddress;

  router.post("/preview", async (request: Request, response: Response) => {
    const address = request.body?.address;
    if (typeof address !== "string" || !address.trim()) {
      return response.status(400).json({error: {code: "INVALID_GEOCODING_INPUT", message: "Informe um endereço para localizar."}});
    }

    try {
      return response.json(await geocode(address.trim()));
    } catch (error) {
      if (error instanceof GeocodingNotFoundError) {
        return response.status(404).json({error: {code: "GEOCODING_NOT_FOUND", message: "Não encontramos esse endereço."}});
      }
      if (error instanceof GeocodingProviderError) {
        logExternalProviderFailure("GEOCODING_FAILED", "LocationIQ", error, error.status);
        return response.status(502).json({error: {code: "GEOCODING_PROVIDER_UNAVAILABLE", message: "O serviço de localização está temporariamente indisponível."}});
      }
      logExternalProviderFailure("GEOCODING_FAILED", "LocationIQ", error);
      return response.status(500).json({error: {code: "INTERNAL_ERROR", message: "Não foi possível localizar o endereço."}});
    }
  });

  return router;
}

export default createGeocodingRouter;
