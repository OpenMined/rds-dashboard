import webbrowser

from fastapi import HTTPException
from loguru import logger
from syft_core import Client as SyftBoxClient
from syft_rds import init_session

from ...models import ListJobsResponse


class JobService:
    """Service class for job-related operations."""

    def __init__(self, syftbox_client: SyftBoxClient):
        self.syftbox_client = syftbox_client
        self.rds_client = init_session(syftbox_client.email)

    async def list_jobs(self) -> ListJobsResponse:
        """List all jobs in the system."""
        try:
            jobs = self.rds_client.jobs.get_all()
            return ListJobsResponse(jobs=jobs)
        except Exception as e:
            logger.error(f"Error listing jobs: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def open_job_code(self, job_uid: str) -> None:
        """Open the job code directory in the file browser."""
        try:
            job = self.rds_client.jobs.get(uid=job_uid)
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )

            # Open the job's code directory
            webbrowser.open(f"file://{job.user_code.local_dir}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error opening job code: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        

    async def approve(self, job_uid: str):
        """Approve a job request by its UID."""
        try:
            job = self.rds_client.jobs.get(uid=job_uid)
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )

            self.rds_client.jobs.approve(job)
            logger.info(f"Job {job_uid} approved.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error approving job: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        
    async def reject(self, job_uid: str):
        """Reject a job request by its UID."""
        try:
            job = self.rds_client.jobs.get(uid=job_uid)
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )

            self.rds_client.jobs.reject(job)
            logger.info(f"Job {job_uid} rejected.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error rejecting job: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        

