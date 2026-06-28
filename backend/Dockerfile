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
ENV PYTHONFAULTHANDLER=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# start.sh: tests imports (so errors appear in logs), then runs gunicorn with
# --preload (app loads in master, not silently-crashing workers).
CMD ["/app/start.sh"]
