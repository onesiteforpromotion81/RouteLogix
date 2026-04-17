# RouteLogix

Full-stack Django + React assessment app for FMCSA HOS route planning and daily log sheet generation.

## Stack

- Backend: Django + Django REST Framework
- Frontend: React + Vite + Leaflet/OpenStreetMap
- Routing API: OSRM public API
- Geocoding API: OpenStreetMap Nominatim

## Features Implemented

- Inputs:
  - Current location
  - Pickup location
  - Dropoff location
  - Current cycle used (hours)
- Outputs:
  - Route map with polyline between pickup and dropoff
  - Stop/rest timeline (pickup, fuel stops, 30-minute breaks, resets, dropoff)
  - Auto-generated daily ELD-style log sheets for multi-day trips
- Assumptions used in logic:
  - Property-carrying driver
  - 70 hours / 8 days cycle
  - No adverse driving condition exception
  - Fueling at least once every 1,000 miles
  - 1 hour for pickup and 1 hour for dropoff

## Local Run

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

Backend URL: `http://127.0.0.1:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://127.0.0.1:5173`

If your backend runs elsewhere, set:

```bash
set VITE_API_BASE=http://your-backend-url
```

## Production Hosting

- Frontend can be deployed directly to Vercel from `frontend/`.
- Backend can be deployed on Render/Railway/Fly/Heroku-like platforms.
- Set frontend env `VITE_API_BASE` to your deployed backend URL.