from fastapi import APIRouter

from app.api.v1 import access, attendance, auth, catalog, dashboard, gate, integrations, nurse

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(nurse.router)
api_router.include_router(gate.router)
api_router.include_router(attendance.router)
api_router.include_router(dashboard.router)
api_router.include_router(access.router)
api_router.include_router(integrations.router)
