from app.models.enums import LocationStatus
from app.schemas.common import ORMModel


class ClassRoomOut(ORMModel):
    id: int
    number: str
    name: str


class SubjectOut(ORMModel):
    id: int
    name: str


class SchoolClassOut(ORMModel):
    id: int
    name: str
    grade_level: int
    classroom_id: int | None = None
    homeroom_teacher_id: int | None = None
    student_count: int = 0


class StudentOut(ORMModel):
    id: int
    full_name: str
    class_id: int
    class_name: str
    rfid_card_id: str | None = None
    parent_phone: str | None = None
    status: LocationStatus = LocationStatus.UNKNOWN
