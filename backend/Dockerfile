FROM python:3.11-slim

# System dependencies for WeasyPrint (PDF generation) and other native libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    # WeasyPrint / Cairo / Pango
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    # WeasyPrint font rendering
    fonts-liberation \
    fonts-dejavu-core \
    # Build tools for Python packages with C extensions
    gcc \
    g++ \
    # PostgreSQL client libs (psycopg2)
    libpq-dev \
    # Misc utilities
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Gunicorn manages worker processes; uvicorn worker class handles async.
# Port is hardcoded to 8000 to match WEBSITES_PORT in Azure App Settings.
CMD ["sh", "-c", "exec gunicorn main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers ${WEB_WORKERS:-2} --timeout 120 --access-logfile - --error-logfile - --log-level info"]
