from fastapi import APIRouter, Depends

from fastapi import status
from fastapi.responses import JSONResponse
from syft_rds import RDSClient

from ..dependencies import get_rds_client
from ..services.job_service import JobService
from ...models import ListJobsResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get(
    "",
    summary="List all jobs",
    description="Retrieve a list of all jobs in the system",
    response_model=ListJobsResponse,
)
async def list_jobs(
    rds_client: RDSClient = Depends(get_rds_client),
) -> ListJobsResponse:
    """Get all jobs in the system."""
    service = JobService(rds_client)
    return await service.list_jobs()


@router.post(
    "/approve/{job_uid}",
    summary="Approve a job request",
    description="Approve a job by its UID.",
    status_code=status.HTTP_200_OK,
)
async def approve_job(
    job_uid: str,
    rds_client: RDSClient = Depends(get_rds_client),
):
    service = JobService(rds_client)
    await service.approve(job_uid)
    return JSONResponse(
        content={"message": f"Job {job_uid} approved."}, status_code=200
    )


@router.post(
    "/reject/{job_uid}",
    summary="Reject a job request",
    description="Reject a job by its UID.",
    status_code=status.HTTP_200_OK,
)
async def reject_job(
    job_uid: str,
    rds_client: RDSClient = Depends(get_rds_client),
):
    service = JobService(rds_client)
    await service.reject(job_uid)
    return JSONResponse(
        content={"message": f"Job {job_uid} rejected."}, status_code=200
    )


@router.get(
    "/open-code/{job_uid}",
    summary="Open job code in browser",
    description="Open the code directory for a specific job in the default file browser",
)
async def open_job_code(
    job_uid: str,
    rds_client: RDSClient = Depends(get_rds_client),
):
    """Open job code directory in the system file browser."""
    service = JobService(rds_client)
    await service.open_job_code(job_uid)
    return {"message": f"Opened code directory for job {job_uid}"}
