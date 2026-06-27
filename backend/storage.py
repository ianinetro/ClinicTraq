"""
Cloudflare R2 storage client (S3-compatible, zero egress fees).
Used for ERA files, generated PDFs, patient document uploads, exports.
"""
from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from config import settings


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_file(
    data: bytes,
    filename: str,
    folder: str = "uploads",
    content_type: Optional[str] = None,
) -> str:
    """Upload bytes to R2. Returns the object key."""
    if not settings.storage_configured:
        # Dev fallback: write to local data/uploads/
        local_dir = Path("data/uploads") / folder
        local_dir.mkdir(parents=True, exist_ok=True)
        key = f"{folder}/{uuid.uuid4().hex}_{filename}"
        (Path("data/uploads") / key).write_bytes(data)
        return key

    key = f"{folder}/{uuid.uuid4().hex}_{filename}"
    ct = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    _client().put_object(
        Bucket=settings.R2_BUCKET,
        Key=key,
        Body=data,
        ContentType=ct,
    )
    return key


def presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL valid for expires_in seconds."""
    if not settings.storage_configured:
        return f"/data/uploads/{key}"

    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


def delete_file(key: str) -> None:
    if not settings.storage_configured:
        path = Path("data/uploads") / key
        if path.exists():
            path.unlink()
        return

    try:
        _client().delete_object(Bucket=settings.R2_BUCKET, Key=key)
    except ClientError:
        pass
