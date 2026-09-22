import {MapContainer, Marker, TileLayer, useMap} from "react-leaflet";
import L from "leaflet";
import {useEffect} from "react";

export interface EmployeeCoordinates {
  latitude: number;
  longitude: number;
}

function Recenter({coordinates}: {coordinates: EmployeeCoordinates}) {
  const map = useMap();
  useEffect(() => {
    map.setView([coordinates.latitude, coordinates.longitude], Math.max(map.getZoom(), 15));
  }, [coordinates.latitude, coordinates.longitude, map]);
  return null;
}

export function EmployeeLocationMap({coordinates, onChange}: {
  coordinates: EmployeeCoordinates;
  onChange: (coordinates: EmployeeCoordinates) => void;
}) {
  const icon = L.divIcon({className: "employee-marker", html: "<span aria-hidden=\"true\"></span>", iconSize: [22, 22], iconAnchor: [11, 11]});
  return <div className="employee-location-map" aria-label="Mapa da localização do funcionário">
    <MapContainer center={[coordinates.latitude, coordinates.longitude]} zoom={15} scrollWheelZoom className="leaflet-container">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter coordinates={coordinates} />
      <Marker
        position={[coordinates.latitude, coordinates.longitude]}
        icon={icon}
        draggable
        eventHandlers={{dragend: (event) => {
          const marker = event.target as L.Marker;
          const point = marker.getLatLng();
          onChange({latitude: point.lat, longitude: point.lng});
        }}}
      />
    </MapContainer>
  </div>;
}
