export interface Coordinates {
    latitude: number;
    longitude: number;
}

export function calculateDistance(from: Coordinates, to: Coordinates): number {
    const earthRadius = 6371;

    const lat1 = toRadians(from.latitude);
    const lat2 = toRadians(to.latitude);
    
    const deltaLat = toRadians(to.latitude - from.latitude);
    const deltaLon = toRadians(to.longitude - from.longitude);

    const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
}

export function calculateBearing(from: Coordinates, to: Coordinates): number {
    const lat1 = toRadians(from.latitude);
    const lat2 = toRadians(to.latitude);

    const deltaLon = toRadians(to.longitude - from.longitude);

    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;

    return (bearing + 360) % 360;
}

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}