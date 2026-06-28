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

# Azure App Service sets PORT; WEB_WORKERS can be overridden via App Settings
CMD ["sh", "-c", "exec python3 -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_WORKERS:-2} --proxy-headers --forwarded-allow-ips='*'"]
