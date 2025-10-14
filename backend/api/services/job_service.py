import webbrowser
from uuid import UUID

from fastapi import HTTPException
from loguru import logger
from syft_rds import RDSClient

from ...models import ListJobsResponse


class JobService:
    """Service class for job-related operations."""

    def __init__(self, rds_client: RDSClient):
        self.rds_client = rds_client
        self.syftbox_client = rds_client._syftbox_client

    async def list_jobs(self) -> ListJobsResponse:
        """List all jobs in the system."""
        try:
            jobs = self.rds_client.job.get_all()
            return ListJobsResponse(jobs=jobs)
        except Exception as e:
            logger.error(f"Error listing jobs: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_job(self, job_uid: str):
        """Get detailed metadata for a specific job."""
        try:
            job = self.rds_client.job.get(uid=UUID(job_uid))
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )
            return job
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting job {job_uid}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def open_job_code(self, job_uid: str) -> None:
        """Open the job code directory in the file browser."""
        try:
            job = self.rds_client.job.get(uid=job_uid)
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
            job = self.rds_client.job.get(uid=job_uid)
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )

            self.rds_client.job.approve(job)
            logger.info(f"Job {job_uid} approved.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error approving job: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def reject(self, job_uid: str):
        """Reject a job request by its UID."""
        try:
            job = self.rds_client.job.get(uid=job_uid)
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )

            self.rds_client.job.reject(job)
            logger.info(f"Job {job_uid} rejected.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error rejecting job: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def run(self, job_uid: str) -> None:
        """Run an approved job on private data."""
        try:
            job = self.rds_client.job.get(uid=job_uid)
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )

            # Run job in non-blocking mode (background)
            self.rds_client.run_private(
                job=job,
                blocking=False,  # Run in background
            )
            logger.info(f"Job {job_uid} started in background.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error running job: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_logs(self, job_uid: str) -> dict[str, str]:
        """Get stdout and stderr logs for a job."""
        try:
            return self.rds_client.job.get_logs(UUID(job_uid))
        except ValueError as e:
            # Logs don't exist yet (job not executed) or invalid UUID
            logger.warning(f"Logs not found for job {job_uid}: {e}")
            raise HTTPException(
                status_code=404,
                detail=f"Logs not available for job {job_uid}. Job may not have been executed yet.",
            )
        except Exception as e:
            logger.error(f"Error getting logs for job {job_uid}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def delete(self, job_uid: str) -> None:
        """Delete a job by its UID."""
        try:
            success = self.rds_client.job.delete(UUID(job_uid))
            if not success:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )
            logger.info(f"Job {job_uid} deleted.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting job {job_uid}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
