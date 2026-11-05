from pydantic import BaseModel


class ClassCheckIn(BaseModel):
    """Перекличка учителя: кто присутствует на уроке."""

    class_id: int
    present_student_ids: list[int]


class ClassCheckOut(BaseModel):
    marked_in_class: list[int]
    marked_missing: list[int]
    skipped_in_nurse: list[int]  # ученик в медпункте — отметка учителя статус не меняет
