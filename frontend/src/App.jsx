import { useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";

const RAW_API_BASE = import.meta.env.VITE_API_BASE;
const API_BASE =
  RAW_API_BASE !== undefined && RAW_API_BASE !== null && String(RAW_API_BASE).trim() !== ""
    ? String(RAW_API_BASE).replace(/\/$/, "")
    : import.meta.env.PROD
      ? ""
      : "http://127.0.0.1:8000";

function planTripUrl() {
  return API_BASE ? `${API_BASE}/api/plan-trip/` : "/api/plan-trip/";
}

function DailyLog({ log, currentLocation, pickupLocation, dropoffLocation }) {
  const rows = [
    { id: "off_duty", label: "1: OFF DUTY", y: 40 },
    { id: "sleeper", label: "2: SLEEPER BERTH", y: 76 },
    { id: "driving", label: "3: DRIVING", y: 112 },
    { id: "on_duty", label: "4: ON DUTY (NOT DRIVING)", y: 148 },
  ];
  const rowMap = Object.fromEntries(rows.map((row) => [row.id, row]));
  const chartLeft = 170;
  const chartWidth = 720;
  const chartTop = 20;
  const chartBottom = 162;
  const remarksBaseY = chartBottom + 30;

  const dutyPathLines = [];
  const changeMarkers = [];
  for (let i = 0; i < log.segments.length; i += 1) {
    const segment = log.segments[i];
    const row = rowMap[segment.status];
    if (!row) continue;
    const x1 = chartLeft + (segment.start / 24) * chartWidth;
    const x2 = chartLeft + (segment.end / 24) * chartWidth;
    dutyPathLines.push(
      <line
        key={`h-${segment.status}-${segment.start}-${segment.end}`}
        x1={x1}
        y1={row.y}
        x2={x2}
        y2={row.y}
        stroke="#2d4ea1"
        strokeWidth="3"
        strokeLinecap="round"
      />
    );
    const next = log.segments[i + 1];
    if (next && next.start === segment.end) {
      const nextRow = rowMap[next.status];
      if (nextRow && nextRow.y !== row.y) {
        changeMarkers.push({
          hour: segment.end,
          note: next.note || "",
          location: next.location || "",
        });
        dutyPathLines.push(
          <line
            key={`v-${segment.end}-${segment.status}-${next.status}-${i}`}
            x1={x2}
            y1={row.y}
            x2={x2}
            y2={nextRow.y}
            stroke="#2d4ea1"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        );
      }
    }
  }
  const uniqueChanges = changeMarkers.filter((item, idx, arr) => {
    return idx === arr.findIndex((x) => x.hour === item.hour && x.note === item.note && x.location === item.location);
  });
  const sortedChanges = [...uniqueChanges].sort((a, b) => a.hour - b.hour);

  const remarkLinesFor = (change) => {
    const location = (change.location || "").replace(/\s+/g, " ").trim();
    const note = (change.note || "").replace(/\s+/g, " ").trim();
    const lines = [];
    if (location) lines.push(location);
    if (note) lines.push(note);
    return lines.length ? lines : ["—"];
  };

  const remarkPlacements = [];
  let previousAnchorX = -999;
  let clusterIndex = 0;
  for (let i = 0; i < sortedChanges.length; i += 1) {
    const change = sortedChanges[i];
    const anchorX = chartLeft + (change.hour / 24) * chartWidth;
    if (Math.abs(anchorX - previousAnchorX) > 56) {
      clusterIndex = 0;
    } else {
      clusterIndex += 1;
    }
    previousAnchorX = anchorX;

    const lane = clusterIndex % 4;
    const lines = remarkLinesFor(change);
    const leftShift = 26 + lane * 12;
    const textX = Math.max(chartLeft + 6, anchorX - leftShift);
    remarkPlacements.push({ anchorX, lane, textX, lines });
  }

  const getHourMinuteDigits = (value) => {
    const totalMinutes = Math.round((value || 0) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      hourTens: Math.floor(hours / 10),
      hourOnes: hours % 10,
      minuteTens: Math.floor(minutes / 10),
      minuteOnes: minutes % 10,
    };
  };
  const totalHourRows = [log.totals.off_duty, log.totals.sleeper, log.totals.driving, log.totals.on_duty].map(getHourMinuteDigits);

  return (
    <div className="paper-log">
      <div className="paper-headline">
        <div className="left-headline">
          <div className="tiny-field"><span>Driver Number</span><strong></strong></div>
          <div className="tiny-field"><span>Driver Initials</span><strong></strong></div>
        </div>
        <div className="center-headline">
          <h3>DRIVER'S DAILY LOG</h3>
          <p>(ONE CALENDAR DAY - 24 HOURS)</p>
        </div>
        <div className="right-headline">
          <div className="tiny-field"><span>(Month) (Day) (Year)</span><strong></strong></div>
          <div className="tiny-field"><span>(End Date)</span><strong></strong></div>
        </div>
      </div>

      <div className="paper-log-top top-grid">
        <div>
          <span>Driver Signature in Full</span>
          <strong></strong>
        </div>
        <div>
          <span>Vehicle Numbers (Show Each Unit)</span>
          <strong></strong>
        </div>
        <div>
          <span>Original / Duplicate</span>
          <strong></strong>
        </div>
        <div>
          <span>Total Driving Miles Today</span>
          <strong></strong>
        </div>
        <div>
          <span>Name of Co-Driver</span>
          <strong></strong>
        </div>
        <div>
          <span>Home Operating Center and Address</span>
          <strong>{currentLocation}</strong>
        </div>
        <div>
          <span>Name of Carrier</span>
          <strong></strong>
        </div>
        <div>
          <span>Safety Records Maintained In</span>
          <strong></strong>
        </div>
        <div>
          <span>From</span>
          <strong>{pickupLocation}</strong>
        </div>
        <div>
          <span>To</span>
          <strong>{dropoffLocation}</strong>
        </div>
        <div>
          <span>Date</span>
          <strong>Day {log.day_index}</strong>
        </div>
        <div>
          <span>Total Truck Mileage Today</span>
          <strong></strong>
        </div>
      </div>

      <div className="chart-plus-hours">
      <svg viewBox="0 0 940 360" className="log-grid">
        <rect x="0" y="0" width="940" height="360" fill="#fff" />
        <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke="#2d4ea1" strokeWidth="1.2" />
        {rows.map((row) => (
          <g key={row.id}>
            <text x="8" y={row.y + 4} className="grid-label">
              {row.label}
            </text>
            <line x1={chartLeft} y1={row.y} x2={chartLeft + chartWidth} y2={row.y} stroke="#2d4ea1" strokeWidth="1" />
          </g>
        ))}
        <line x1={chartLeft} y1={chartBottom} x2={chartLeft + chartWidth} y2={chartBottom} stroke="#2d4ea1" strokeWidth="1" />
        {[...Array(25)].map((_, index) => (
          <g key={index}>
            <line
              x1={chartLeft + (index / 24) * chartWidth}
              y1={chartTop}
              x2={chartLeft + (index / 24) * chartWidth}
              y2={chartBottom}
              stroke="#2d4ea1"
              strokeWidth={index % 1 === 0 ? "0.8" : "0.5"}
            />
            {index < 24 && (
              <text x={chartLeft + (index / 24) * chartWidth + 2} y="16" className="grid-hour">
                {index}
              </text>
            )}
          </g>
        ))}
        {[...Array(24 * 4 + 1)].map((_, tickIndex) => {
          const x = chartLeft + (tickIndex / (24 * 4)) * chartWidth;
          const major = tickIndex % 4 === 0;
          const long = tickIndex % 2 === 0;
          return (
            <line
              key={`tick-${tickIndex}`}
              x1={x}
              y1={chartBottom}
              x2={x}
              y2={chartBottom + (major ? 14 : long ? 10 : 7)}
              stroke="#2d4ea1"
              strokeWidth={major ? 1 : 0.8}
            />
          );
        })}
        {dutyPathLines}
        <line x1={chartLeft + chartWidth} y1={chartTop} x2={chartLeft + chartWidth} y2={chartBottom} stroke="#2d4ea1" strokeWidth="1.2" />
        <text x="10" y={remarksBaseY + 8} className="remarks-inline-label">Remarks</text>
        <line x1={chartLeft} y1={remarksBaseY} x2={chartLeft + chartWidth} y2={remarksBaseY} stroke="#9bb0df" strokeWidth="1" />
        {remarkPlacements.length === 0 && (
          <text x={chartLeft + 6} y={remarksBaseY + 24} className="remark-empty-text">
            No status changes recorded.
          </text>
        )}
        {remarkPlacements.map(({ anchorX, lane, textX, lines }, idx) => {
          const elbowY = remarksBaseY + 14 + lane * 32;
          const bendX = anchorX - 12;
          const textY = elbowY + 28;
          return (
            <g key={`in-chart-remark-${idx}`}>
              <line x1={anchorX} y1={chartBottom + 2} x2={anchorX} y2={elbowY} stroke="#111" strokeWidth="1.8" />
              <line x1={anchorX} y1={elbowY} x2={bendX} y2={elbowY} stroke="#111" strokeWidth="1.8" />
              <line x1={bendX} y1={elbowY} x2={textX} y2={textY - 6} stroke="#111" strokeWidth="1.8" />
              <text x={textX} y={textY} className="remark-angled-text" transform={`rotate(-44 ${textX} ${textY})`}>
                {lines.map((line, li) => (
                  <tspan key={li} x={textX} dy={li === 0 ? 0 : 10.5}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="total-hours-panel">
        <div className="total-hours-head">
          <div>HOURS</div>
          <div>MINUTES TO BE<br />00, 15, 30, 45</div>
        </div>
        <div className="hours-grid">
          {totalHourRows.map((digits, idx) => (
            <div key={idx} className="hours-row">
              <div className="digit-box">{digits.hourTens}</div>
              <div className="digit-box">{digits.hourOnes}</div>
              <div className="digit-box">{digits.minuteTens}</div>
              <div className="digit-box">{digits.minuteOnes}</div>
            </div>
          ))}
        </div>
        <div className="panel-title">TOTAL HOURS</div>
      </div>
      </div>

      <div className="paper-log-shipping">
        <div>
          <span>Shipper</span>
          <strong></strong>
        </div>
        <div>
          <span>Commodity</span>
          <strong></strong>
        </div>
        <div>
          <span>Load No.</span>
          <strong></strong>
        </div>
      </div>
      <div className="remarks-footnote">Each change of duty status must have a location in the "remarks" section. Use local time standard at home operating center.</div>

      <div className="paper-log-recap">
        <div>
          <span>Off Duty</span>
          <strong>{log.totals.off_duty}h</strong>
        </div>
        <div>
          <span>Sleeper</span>
          <strong>{log.totals.sleeper}h</strong>
        </div>
        <div>
          <span>Driving</span>
          <strong>{log.totals.driving}h</strong>
        </div>
        <div>
          <span>On Duty</span>
          <strong>{log.totals.on_duty}h</strong>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [form, setForm] = useState({
    current_location: "",
    pickup_location: "",
    dropoff_location: "",
    current_cycle_used_hours: "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [logPage, setLogPage] = useState(0);

  const polyline = useMemo(() => {
    const coordinates = result?.route?.geometry?.coordinates || [];
    return coordinates.map(([lon, lat]) => [lat, lon]);
  }, [result]);

  const markers = useMemo(() => {
    if (!polyline.length) return [];
    return [polyline[0], polyline[polyline.length - 1]];
  }, [polyline]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(planTripUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          current_cycle_used_hours: Number(form.current_cycle_used_hours),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Request failed");
      }
      setResult(payload);
      setLogPage(0);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>RouteLogix - HOS Trip Planner</h1>
        <p>Assumptions: Property-carrying driver, 70h/8-day, no adverse conditions.</p>
        <form onSubmit={submit} className="form">
          <input
            required
            placeholder="Current location"
            value={form.current_location}
            onChange={(e) => setForm((prev) => ({ ...prev, current_location: e.target.value }))}
          />
          <input
            required
            placeholder="Pickup location"
            value={form.pickup_location}
            onChange={(e) => setForm((prev) => ({ ...prev, pickup_location: e.target.value }))}
          />
          <input
            required
            placeholder="Dropoff location"
            value={form.dropoff_location}
            onChange={(e) => setForm((prev) => ({ ...prev, dropoff_location: e.target.value }))}
          />
          <input
            required
            type="number"
            min="0"
            max="70"
            step="0.25"
            placeholder="Current Cycle Used (hrs)"
            value={form.current_cycle_used_hours}
            onChange={(e) => setForm((prev) => ({ ...prev, current_cycle_used_hours: e.target.value }))}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Calculating..." : "Generate Route + Logs"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <>
          <section className="card">
            <h2>Route</h2>
            <p>
              Distance: <strong>{result.route.distance_miles} miles</strong> | Est. drive:{" "}
              <strong>{result.route.duration_hours} h</strong>
            </p>
            <div className="map-wrap">
              <MapContainer center={markers[0] || [39.5, -98.35]} zoom={5} scrollWheelZoom>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {polyline.length > 1 && <Polyline positions={polyline} color="#0b4f9c" weight={4} />}
                {markers[0] && (
                  <Marker position={markers[0]}>
                    <Popup>Pickup</Popup>
                  </Marker>
                )}
                {markers[1] && (
                  <Marker position={markers[1]}>
                    <Popup>Dropoff</Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </section>

          <section className="card">
            <h2>Stops and Rests</h2>
            <ul className="stops">
              {result.plan.stops.map((stop, idx) => (
                <li key={idx}>
                  T+{stop.hour}h | {stop.type.toUpperCase()} | {stop.location} ({stop.duration_h}h)
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>Daily Log Sheets</h2>
            <div className="log-pagination">
              <button type="button" onClick={() => setLogPage((prev) => Math.max(0, prev - 1))} disabled={logPage === 0}>
                Previous
              </button>
              <span>
                Page {logPage + 1} / {result.plan.daily_logs.length}
              </span>
              <button
                type="button"
                onClick={() => setLogPage((prev) => Math.min(result.plan.daily_logs.length - 1, prev + 1))}
                disabled={logPage >= result.plan.daily_logs.length - 1}
              >
                Next
              </button>
            </div>
            <DailyLog
              key={result.plan.daily_logs[logPage].day_index}
              log={result.plan.daily_logs[logPage]}
              currentLocation={result.input_echo.current_location}
              pickupLocation={result.input_echo.pickup_location}
              dropoffLocation={result.input_echo.dropoff_location}
            />
          </section>
        </>
      )}
    </main>
  );
}
