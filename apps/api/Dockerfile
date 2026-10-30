FROM python:3.12-slim

WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install shared package dependencies
COPY packages/shared /workspace/packages/shared
RUN pip install --no-cache-dir -e /workspace/packages/shared

# Install API dependencies
COPY apps/api/requirements.txt /workspace/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /workspace/apps/api/requirements.txt

# Copy API application code
COPY apps/api /workspace/apps/api

ENV PYTHONPATH=/workspace:/workspace/apps/api

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "/workspace/apps/api"]
