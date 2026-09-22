export class GeocodingNotFoundError extends Error {
    constructor() {
        super('Address not found');
        this.name = 'GeocodingNotFoundError';
    }
}

export class GeocodingProviderError extends Error {
    constructor(message = "Geocoding provider failed.", public readonly status?: number) {
        super(message);
        this.name = 'GeocodingProviderError';
    }
}
