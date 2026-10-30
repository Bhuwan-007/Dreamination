FROM python:3.12-slim

WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install shared dependencies
COPY packages/shared /workspace/packages/shared
RUN pip install --no-cache-dir -e /workspace/packages/shared

# Install worker dependencies
COPY apps/worker/requirements.txt /workspace/apps/worker/requirements.txt
RUN pip install --no-cache-dir -r /workspace/apps/worker/requirements.txt

# Copy worker application code
COPY apps/worker /workspace/apps/worker

ENV PYTHONPATH=/workspace:/workspace/apps/worker

CMD ["celery", "-A", "src.worker.celery_app", "worker", "--loglevel=INFO", "--workdir=/workspace/apps/worker"]
