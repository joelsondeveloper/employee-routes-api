export class GeocodingNotFoundError extends Error {
    constructor() {
        super('Address not found');
        this.name = 'GeocodingNotFoundError';
    }
}

export class GeocodingProviderError extends Error {
    constructor(message = "Geocoding provider failed.") {
        super(message);
        this.name = 'GeocodingProviderError';
    }
}