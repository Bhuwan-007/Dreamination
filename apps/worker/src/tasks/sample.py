import time
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


def report_progress(task_instance, stage: str, percent: int, metadata: dict | None = None):
    """
    Helper to report pipeline task progress to Celery backend.
    Enforces Rule 6: metadata must NEVER contain raw dream text.
    """
    payload = {
        "stage": stage,
        "percent": percent,
        "metadata": metadata or {},
    }
    task_instance.update_state(state="PROGRESS", meta=payload)
    logger.info(f"Task progress [{stage}]: {percent}%")


@shared_task(bind=True, name="tasks.sample_render")
def sample_render_task(self, dream_id: str) -> dict:
    """
    Sample async worker task simulating the dream render pipeline stages
    from architecture.md Section 9: director -> textures_skybox -> tts -> ambient -> package.
    """
    logger.info(f"Starting sample render job for dream_id={dream_id}")

    stages = [
        ("director", 20, 0.5),
        ("textures_skybox", 40, 0.5),
        ("tts", 65, 0.5),
        ("ambient", 85, 0.5),
        ("package", 100, 0.5),
    ]

    for stage, percent, delay in stages:
        time.sleep(delay)
        report_progress(self, stage=stage, percent=percent)

    logger.info(f"Completed render job for dream_id={dream_id}")
    return {
        "status": "completed",
        "dream_id": dream_id,
        "manifest_url": f"/storage/manifests/{dream_id}/scene_manifest.json",
    }
