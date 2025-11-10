from pathlib import Path
from uuid import UUID

from fastapi import HTTPException
from loguru import logger
from syft_rds import RDSClient

from ...models import ListJobsResponse


# Security and resource limits
MAX_PREVIEW_SIZE = 1024 * 1024  # 1MB per file
MAX_TOTAL_SIZE = 50 * 1024 * 1024  # 50MB total
MAX_FILE_COUNT = 1000  # Maximum number of files


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

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size with appropriate units consistently."""
        MB = 1024 * 1024
        KB = 1024

        if size_bytes >= MB:
            return f"{size_bytes / MB:.2f} MB"
        elif size_bytes >= KB:
            return f"{size_bytes / KB:.2f} KB"
        return f"{size_bytes} B"

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

    async def get_job_code(self, job_uid: str) -> dict[str, dict[str, str]]:
        """Get the job code files and their contents."""
        try:
            job = self.rds_client.job.get(uid=UUID(job_uid))
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )

            code_dir = Path(job.user_code.local_dir)
            files = {}

            if not code_dir.exists():
                logger.warning(f"Code directory does not exist: {code_dir}")
                return {"code_dir": str(code_dir), "files": {}}

            # Resolve paths for security validation
            code_dir_resolved = code_dir.resolve()

            # Directories and patterns to ignore
            ignore_patterns = {
                ".venv",
                "venv",
                "__pycache__",
                ".git",
                ".pytest_cache",
                ".mypy_cache",
                ".ruff_cache",
                "node_modules",
                ".tox",
                ".eggs",
                ".egg-info",
                ".coverage",
                "htmlcov",
                "dist",
                "build",
                ".DS_Store",
            }

            def should_ignore(path: Path) -> bool:
                """Check if path should be ignored."""
                parts = path.parts
                for part in parts:
                    # Check against ignore patterns
                    if part in ignore_patterns:
                        return True
                    # Check if it's an egg-info directory
                    if part.endswith(".egg-info"):
                        return True
                return False

            total_size = 0
            file_count = 0

            # Read all files (except ignored ones)
            for file_path in code_dir.rglob("*"):
                # Skip directories
                if file_path.is_dir():
                    continue

                # Security: Validate file is within code directory (prevent path traversal)
                try:
                    file_path.resolve().relative_to(code_dir_resolved)
                except ValueError:
                    logger.warning(f"Path traversal attempt detected: {file_path}")
                    continue

                # Skip ignored paths
                if should_ignore(file_path.relative_to(code_dir)):
                    continue

                # Check file count limit
                file_count += 1
                if file_count > MAX_FILE_COUNT:
                    logger.warning(
                        f"File count limit ({MAX_FILE_COUNT}) exceeded for job {job_uid}"
                    )
                    files["_limit_exceeded"] = (
                        f"[Job contains too many files. Only first {MAX_FILE_COUNT} files shown]"
                    )
                    break

                relative_path = file_path.relative_to(code_dir)
                file_size = file_path.stat().st_size

                # Check file size limit
                if file_size > MAX_PREVIEW_SIZE:
                    files[str(relative_path)] = (
                        f"[File too large to preview: {self._format_file_size(file_size)}]"
                    )
                    continue

                # Check total size limit
                if total_size + file_size > MAX_TOTAL_SIZE:
                    files[str(relative_path)] = "[Total preview size limit exceeded]"
                    continue

                try:
                    # Try to read as text with explicit UTF-8 encoding
                    content = file_path.read_text(encoding="utf-8", errors="replace")
                    files[str(relative_path)] = content
                    total_size += file_size
                except UnicodeDecodeError:
                    files[str(relative_path)] = "[Unable to decode file as UTF-8]"
                    logger.debug(f"Unicode decode error for {file_path}")
                except Exception as e:
                    # Skip binary files or unreadable files
                    files[str(relative_path)] = f"[Error reading file: {str(e)}]"
                    logger.debug(f"Skipping {file_path}: {e}")

            return {"code_dir": str(code_dir), "files": files}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting job code: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def approve(self, job_uid: str):
        """Approve a job request by its UID."""
        try:
            job = self.rds_client.job.get(uid=UUID(job_uid))
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
            job = self.rds_client.job.get(uid=UUID(job_uid))
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
            job = self.rds_client.job.get(uid=UUID(job_uid))
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

    async def get_output_files(self, job_uid: str) -> dict[str, dict[str, str]]:
        """Get the job output files and their contents."""
        try:
            return self.rds_client.job.get_output_dir(UUID(job_uid))
        except ValueError as e:
            # Output doesn't exist yet (job not executed) or invalid UUID
            logger.warning(f"Output not found for job {job_uid}: {e}")
            raise HTTPException(
                status_code=404,
                detail=f"Output not available for job {job_uid}. Job may not have been executed yet.",
            )
        except Exception as e:
            logger.error(f"Error getting output for job {job_uid}: {e}")
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

    async def delete_all(self) -> int:
        """Delete all jobs in the system."""
        try:
            deleted_count = self.rds_client.job.delete_all()
            logger.info(f"Deleted {deleted_count} job(s).")
            return deleted_count
        except Exception as e:
            logger.error(f"Error deleting all jobs: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def rerun(self, job_uid: str) -> None:
        """Rerun a finished or failed job.

        This will re-approve the job if needed and run it again.
        """
        try:
            job = self.rds_client.job.get(uid=UUID(job_uid))
            if not job:
                raise HTTPException(
                    status_code=404, detail=f"Job with UID '{job_uid}' not found"
                )

            # Check if job is in a rerunnable state (finished or failed)
            if job.status not in ["job_run_finished", "job_run_failed", "shared"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Job {job_uid} cannot be rerun. Current status: {job.status}. Only finished or failed jobs can be rerun.",
                )

            # Re-approve the job first?
            # self.rds_client.job.approve(job)
            # logger.info(f"Job {job_uid} re-approved for rerun.")

            # Run the job in non-blocking mode
            self.rds_client.run_private(
                job=job,
                blocking=False,
            )
            logger.info(f"Job {job_uid} restarted in background.")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error rerunning job: {e}")
            raise HTTPException(status_code=500, detail=str(e))
