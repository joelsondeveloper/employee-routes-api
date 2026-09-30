import {useEffect} from "react";
import {CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap} from "react-leaflet";
import type {LatLngBoundsExpression} from "leaflet";
import type {RouteGroup, RouteStop} from "../types/api";
import {groupPassengersByLocation} from "../lib/route-map-utils";

function MapViewport({stops}: {stops: RouteStop[]}) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 0) return;
    const bounds: LatLngBoundsExpression = stops.map((stop) => [stop.latitude, stop.longitude]);
    map.fitBounds(bounds, {padding: [34, 34], maxZoom: 14});
  }, [map, stops]);
  // The routes page remains mounted when the employee page is shown.
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export function RouteMap({groups, selectedGroup}: {groups: RouteGroup[]; selectedGroup?: RouteGroup}) {
  const origin = groups[0]?.stops.find((stop) => stop.type === "ORIGIN");
  const passengers = groups.flatMap((group) => group.stops
    .filter((stop) => stop.type === "EMPLOYEE")
    .map((stop, index) => ({stop, order: index + 1, groupNumber: group.groupNumber})));
  const passengerLocations = groupPassengersByLocation(passengers);
  const selectedStops = selectedGroup?.stops ?? [];
  const stopsToFit = selectedGroup ? selectedStops : [...(origin ? [origin] : []), ...passengers.map(({stop}) => stop)];
  const center: [number, number] = origin ? [origin.latitude, origin.longitude] : [-8.1678849, -34.9442083];

  return <div className="map-shell" aria-label="Mapa da sequência de paradas">
    <MapContainer center={center} zoom={12} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {origin && <CircleMarker center={[origin.latitude, origin.longitude]} radius={10}
        pathOptions={{color: "#102a43", fillColor: "#102a43", fillOpacity: 1, weight: 2}}>
        <Tooltip>Empresa · origem</Tooltip><Popup><strong>Empresa</strong><br />Origem dos grupos</Popup>
      </CircleMarker>}
      {passengerLocations.map(({latitude, longitude, passengers: locationPassengers}) => {
        const selected = locationPassengers.some(({groupNumber}) => groupNumber === selectedGroup?.groupNumber);
        const overlapping = locationPassengers.length > 1;
        const firstPassenger = locationPassengers[0];
        const markerKey = locationPassengers.map(({groupNumber, stop}) => `${groupNumber}-${stop.id}`).join("|");
        return <CircleMarker key={markerKey} center={[latitude, longitude]}
          radius={selected ? (overlapping ? 11 : 9) : (overlapping ? 9 : 6)}
          pathOptions={{color: selected ? "#1f6feb" : "#6f8ba5", fillOpacity: selected ? 1 : .65, weight: 2}}>
          <Tooltip permanent={selected || overlapping} direction="top">
            {overlapping
              ? `${locationPassengers.length} paradas no mesmo ponto`
              : selected
                ? String(firstPassenger.order)
                : `Carro ${firstPassenger.groupNumber} · ${firstPassenger.stop.name}`}
          </Tooltip>
          <Popup>
            {overlapping ? <>
              <strong>{locationPassengers.length} paradas no mesmo ponto</strong>
              <ul>
                {locationPassengers.map(({stop, order, groupNumber}) => <li key={`${groupNumber}-${stop.id}`}>
                  Carro {groupNumber} · parada {order}: {stop.name}
                </li>)}
              </ul>
            </> : <><strong>{firstPassenger.stop.name}</strong><br />Carro {firstPassenger.groupNumber} · parada {firstPassenger.order}</>}
          </Popup>
        </CircleMarker>;
      })}
      {selectedStops.length > 1 && <Polyline key={selectedGroup?.groupNumber} interactive={false} positions={selectedStops.map((stop) => [stop.latitude, stop.longitude] as [number, number])}
        pathOptions={{color: "#1f6feb", weight: 3, opacity: .85, dashArray: "7 7"}} />}
      <MapViewport stops={stopsToFit} />
    </MapContainer>
  </div>;
}
