from datetime import datetime

from pydantic import BaseModel

from app.models.enums import GateDirection, LocationStatus


class PulseCounters(BaseModel):
    total_students: int = 0
    in_building: int = 0  # в классе + в медпункте + не дошли + в пансионате
    in_class: int = 0
    in_nurse: int = 0
    in_boarding: int = 0  # пансионеры в пансионате
    not_reached_class: int = 0  # IN_BUILDING
    discrepancies: int = 0  # подмножество not_reached_class
    left_school: int = 0
    not_arrived: int = 0  # UNKNOWN


class ClassPulse(BaseModel):
    class_id: int
    class_name: str
    total: int = 0
    in_class: int = 0
    in_nurse: int = 0
    not_reached_class: int = 0
    in_boarding: int = 0
    absent: int = 0


class StudentLiveRow(BaseModel):
    student_id: int
    full_name: str
    class_id: int
    class_name: str
    status: LocationStatus
    is_discrepancy: bool
    reason: str
    since: datetime | None
    last_gate_direction: GateDirection | None
    last_gate_at: datetime | None
    active_nurse_visit_id: int | None
    is_boarder: bool = False


class LivePulse(BaseModel):
    generated_at: datetime
    counters: PulseCounters
    classes: list[ClassPulse]
    students: list[StudentLiveRow]
