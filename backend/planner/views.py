from __future__ import annotations

from typing import Any, Dict, Tuple
import requests

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .hos import generate_plan


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}"


def _geocode(query: str) -> Tuple[float, float, str]:
    response = requests.get(
        NOMINATIM_URL,
        params={"q": query, "format": "json", "limit": 1},
        headers={"User-Agent": "RouteLogixAssessment/1.0"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload:
        raise ValueError(f"Location not found: {query}")
    item = payload[0]
    return float(item["lat"]), float(item["lon"]), item.get("display_name", query)


def _route(start: Tuple[float, float], end: Tuple[float, float]) -> Dict[str, Any]:
    lat1, lon1 = start
    lat2, lon2 = end
    response = requests.get(
        OSRM_ROUTE_URL.format(lon1=lon1, lat1=lat1, lon2=lon2, lat2=lat2),
        params={"overview": "full", "geometries": "geojson", "steps": "true"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    routes = payload.get("routes", [])
    if not routes:
        raise ValueError("Route could not be generated")
    best = routes[0]
    return {
        "distance_meters": best["distance"],
        "duration_seconds": best["duration"],
        "geometry": best["geometry"],
        "legs": best["legs"],
    }


@api_view(["POST"])
def plan_trip(request):
    required = ["current_location", "pickup_location", "dropoff_location", "current_cycle_used_hours"]
    for key in required:
        if key not in request.data:
            return Response({"error": f"Missing field: {key}"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        current_cycle_used_hours = float(request.data["current_cycle_used_hours"])
    except (TypeError, ValueError):
        return Response({"error": "current_cycle_used_hours must be numeric"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        _, _, current_label = _geocode(request.data["current_location"])
        pickup_lat, pickup_lon, pickup_label = _geocode(request.data["pickup_location"])
        dropoff_lat, dropoff_lon, dropoff_label = _geocode(request.data["dropoff_location"])
        route = _route((pickup_lat, pickup_lon), (dropoff_lat, dropoff_lon))
    except Exception as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    plan = generate_plan(
        total_miles=route["distance_meters"] / 1609.34,
        current_cycle_used_hours=current_cycle_used_hours,
        start_label=current_label,
        pickup_label=pickup_label,
        dropoff_label=dropoff_label,
    )

    return Response(
        {
            "input_echo": {
                "current_location": current_label,
                "pickup_location": pickup_label,
                "dropoff_location": dropoff_label,
                "current_cycle_used_hours": current_cycle_used_hours,
            },
            "route": {
                "distance_miles": round(route["distance_meters"] / 1609.34, 2),
                "duration_hours": round(route["duration_seconds"] / 3600.0, 2),
                "geometry": route["geometry"],
            },
            "plan": plan,
        }
    )
