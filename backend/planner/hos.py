from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any
import math


AVERAGE_MPH = 55.0
MAX_DRIVING_PER_SHIFT = 11.0
MAX_WINDOW_PER_SHIFT = 14.0
BREAK_AFTER_DRIVE = 8.0
BREAK_LENGTH = 0.5
SHIFT_RESET = 10.0
PICKUP_DROPOFF_HOURS = 1.0
FUELING_INTERVAL_MILES = 1000.0
FUELING_DURATION_HOURS = 0.5
MAX_WEEKLY_ON_DUTY = 70.0


@dataclass
class Segment:
    status: str
    start: float
    end: float
    note: str
    location: str


def _push_segment(segments: List[Segment], status: str, start: float, end: float, note: str, location: str) -> None:
    if end <= start:
        return
    segments.append(Segment(status=status, start=start, end=end, note=note, location=location))


def _daily_buckets(segments: List[Segment]) -> List[Dict[str, Any]]:
    max_hour = max((segment.end for segment in segments), default=0.0)
    days = max(1, math.ceil(max_hour / 24.0))
    output: List[Dict[str, Any]] = []
    for day_index in range(days):
        day_start = day_index * 24.0
        day_end = day_start + 24.0
        day_segments = []
        totals = {"off_duty": 0.0, "sleeper": 0.0, "driving": 0.0, "on_duty": 0.0}
        remarks = []

        for segment in segments:
            overlap_start = max(day_start, segment.start)
            overlap_end = min(day_end, segment.end)
            if overlap_end <= overlap_start:
                continue
            local_start = overlap_start - day_start
            local_end = overlap_end - day_start
            day_segments.append(
                {
                    "status": segment.status,
                    "start": round(local_start, 2),
                    "end": round(local_end, 2),
                    "note": segment.note,
                    "location": segment.location,
                }
            )
            totals[segment.status] += overlap_end - overlap_start
            if segment.note:
                remarks.append(
                    {
                        "time": round(local_start, 2),
                        "text": f"{segment.location}: {segment.note}",
                    }
                )

        output.append(
            {
                "day_index": day_index + 1,
                "segments": day_segments,
                "totals": {k: round(v, 2) for k, v in totals.items()},
                "remarks": remarks,
            }
        )
    return output


def generate_plan(
    total_miles: float,
    current_cycle_used_hours: float,
    start_label: str,
    pickup_label: str,
    dropoff_label: str,
) -> Dict[str, Any]:
    drive_hours_total = total_miles / AVERAGE_MPH
    remaining_drive = drive_hours_total
    remaining_cycle = max(0.0, MAX_WEEKLY_ON_DUTY - current_cycle_used_hours)
    current_hour = 0.0
    shift_window_used = 0.0
    shift_drive_used = 0.0
    since_break_drive = 0.0
    driven_miles = 0.0
    next_fuel_mileage = FUELING_INTERVAL_MILES
    segments: List[Segment] = []
    stops: List[Dict[str, Any]] = []

    _push_segment(segments, "on_duty", current_hour, current_hour + PICKUP_DROPOFF_HOURS, "Pre-trip + pickup", pickup_label)
    stops.append({"hour": round(current_hour, 2), "type": "pickup", "location": pickup_label, "duration_h": PICKUP_DROPOFF_HOURS})
    current_hour += PICKUP_DROPOFF_HOURS
    shift_window_used += PICKUP_DROPOFF_HOURS
    remaining_cycle -= PICKUP_DROPOFF_HOURS

    while remaining_drive > 0:
        if remaining_cycle <= 0:
            _push_segment(segments, "off_duty", current_hour, current_hour + 34.0, "34-hour restart", "Roadside")
            stops.append({"hour": round(current_hour, 2), "type": "restart", "location": "Roadside", "duration_h": 34.0})
            current_hour += 34.0
            remaining_cycle = MAX_WEEKLY_ON_DUTY
            shift_window_used = 0.0
            shift_drive_used = 0.0
            since_break_drive = 0.0
            continue

        available_by_shift_drive = MAX_DRIVING_PER_SHIFT - shift_drive_used
        available_by_shift_window = MAX_WINDOW_PER_SHIFT - shift_window_used
        available_by_break = BREAK_AFTER_DRIVE - since_break_drive
        block = min(remaining_drive, available_by_shift_drive, available_by_shift_window, available_by_break)

        if block > 0:
            start = current_hour
            end = current_hour + block
            _push_segment(segments, "driving", start, end, "Linehaul driving", "En route")
            current_hour = end
            remaining_drive -= block
            shift_window_used += block
            shift_drive_used += block
            since_break_drive += block
            remaining_cycle -= block
            driven_miles += block * AVERAGE_MPH

        need_fuel = driven_miles >= next_fuel_mileage and remaining_drive > 0
        need_break = since_break_drive >= BREAK_AFTER_DRIVE and remaining_drive > 0
        shift_exhausted = (shift_drive_used >= MAX_DRIVING_PER_SHIFT or shift_window_used >= MAX_WINDOW_PER_SHIFT) and remaining_drive > 0

        if need_fuel:
            _push_segment(segments, "on_duty", current_hour, current_hour + FUELING_DURATION_HOURS, "Fuel stop", "Truck Stop")
            stops.append({"hour": round(current_hour, 2), "type": "fuel", "location": "Truck Stop", "duration_h": FUELING_DURATION_HOURS})
            current_hour += FUELING_DURATION_HOURS
            shift_window_used += FUELING_DURATION_HOURS
            remaining_cycle -= FUELING_DURATION_HOURS
            next_fuel_mileage += FUELING_INTERVAL_MILES
            continue

        if need_break:
            _push_segment(segments, "off_duty", current_hour, current_hour + BREAK_LENGTH, "30-minute required break", "Rest Area")
            stops.append({"hour": round(current_hour, 2), "type": "rest", "location": "Rest Area", "duration_h": BREAK_LENGTH})
            current_hour += BREAK_LENGTH
            shift_window_used += BREAK_LENGTH
            since_break_drive = 0.0
            continue

        if shift_exhausted:
            _push_segment(segments, "off_duty", current_hour, current_hour + SHIFT_RESET, "10-hour reset", "Sleeper")
            stops.append({"hour": round(current_hour, 2), "type": "reset", "location": "Sleeper", "duration_h": SHIFT_RESET})
            current_hour += SHIFT_RESET
            shift_window_used = 0.0
            shift_drive_used = 0.0
            since_break_drive = 0.0
            continue

    _push_segment(segments, "on_duty", current_hour, current_hour + PICKUP_DROPOFF_HOURS, "Drop-off + post-trip", dropoff_label)
    stops.append({"hour": round(current_hour, 2), "type": "dropoff", "location": dropoff_label, "duration_h": PICKUP_DROPOFF_HOURS})
    current_hour += PICKUP_DROPOFF_HOURS
    remaining_cycle -= PICKUP_DROPOFF_HOURS

    daily_logs = _daily_buckets(segments)
    trip_hours = round(current_hour, 2)
    return {
        "trip_summary": {
            "distance_miles": round(total_miles, 2),
            "estimated_drive_hours": round(drive_hours_total, 2),
            "total_trip_hours_including_stops": trip_hours,
            "ending_cycle_used_hours": round(MAX_WEEKLY_ON_DUTY - max(0.0, remaining_cycle), 2),
        },
        "stops": stops,
        "daily_logs": daily_logs,
    }
