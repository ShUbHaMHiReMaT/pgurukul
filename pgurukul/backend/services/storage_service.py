"""Storage service — Cloudflare R2 or local disk fallback."""
import os
import uuid
import hashlib
from typing import Optional, Tuple
from flask import current_app, url_for

try:
    import boto3
    from botocore.config import Config as BotoConfig
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


class StorageService:
    """Unified storage: R2 (production) or local disk (development)."""

    def __init__(self):
        self._client = None

    def _get_r2_client(self):
        if self._client is None:
            cfg = current_app.config
            endpoint = cfg.get("R2_ENDPOINT_URL", "")
            if not endpoint:
                raise ValueError("R2_ENDPOINT_URL not set")
            self._client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=cfg["R2_ACCESS_KEY_ID"],
                aws_secret_access_key=cfg["R2_SECRET_ACCESS_KEY"],
                config=BotoConfig(
                    signature_version="s3v4",
                    retries={"max_attempts": 3, "mode": "adaptive"},
                ),
            )
        return self._client

    def upload_file(
        self,
        file_obj,
        filename: str,
        department_id: str,
        content_type: str = "application/octet-stream",
    ) -> Tuple[str, str, int]:
        """
        Upload file to R2 or local storage.
        Returns (storage_key, access_url, size_bytes).
        """
        cfg = current_app.config
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        storage_key = f"departments/{department_id}/{unique_name}"

        # Read content
        content = file_obj.read()
        size_bytes = len(content)
        file_obj.seek(0)

        if cfg.get("USE_R2_STORAGE") and BOTO3_AVAILABLE:
            return self._upload_to_r2(content, storage_key, content_type, cfg, size_bytes)
        else:
            return self._upload_to_local(content, storage_key, size_bytes, cfg)

    def _upload_to_r2(
        self, content: bytes, key: str, content_type: str, cfg: dict, size: int
    ) -> Tuple[str, str, int]:
        client = self._get_r2_client()
        client.put_object(
            Bucket=cfg["R2_BUCKET_NAME"],
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        public_base = cfg.get("R2_PUBLIC_URL", "").rstrip("/")
        url = f"{public_base}/{key}" if public_base else ""
        return key, url, size

    def _upload_to_local(
        self, content: bytes, key: str, size: int, cfg: dict
    ) -> Tuple[str, str, int]:
        """Save to UPLOAD_FOLDER and return a download-route URL."""
        base = cfg.get("UPLOAD_FOLDER", "uploads")
        full_path = os.path.join(base, key.replace("/", os.sep))
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(content)
        # URL served via the /files/download/<key> route (built at request time)
        url = f"/files/serve/{key}"
        return key, url, size

    def delete_file(self, storage_key: str) -> bool:
        cfg = current_app.config
        if cfg.get("USE_R2_STORAGE") and BOTO3_AVAILABLE:
            try:
                self._get_r2_client().delete_object(
                    Bucket=cfg["R2_BUCKET_NAME"], Key=storage_key
                )
                return True
            except Exception as e:
                current_app.logger.error(f"R2 delete failed: {e}")
                return False
        else:
            base = cfg.get("UPLOAD_FOLDER", "uploads")
            full_path = os.path.join(base, storage_key.replace("/", os.sep))
            try:
                if os.path.exists(full_path):
                    os.remove(full_path)
                return True
            except OSError as e:
                current_app.logger.error(f"Local delete failed: {e}")
                return False

    def get_file_path(self, storage_key: str) -> str:
        """Return absolute local path for a storage key."""
        cfg = current_app.config
        base = cfg.get("UPLOAD_FOLDER", "uploads")
        return os.path.join(base, storage_key.replace("/", os.sep))

    def get_storage_stats(self) -> dict:
        cfg = current_app.config
        if cfg.get("USE_R2_STORAGE") and BOTO3_AVAILABLE:
            try:
                client = self._get_r2_client()
                paginator = client.get_paginator("list_objects_v2")
                total_size = total_objects = 0
                for page in paginator.paginate(Bucket=cfg["R2_BUCKET_NAME"]):
                    for obj in page.get("Contents", []):
                        total_size += obj["Size"]
                        total_objects += 1
                return {"total_bytes": total_size, "total_objects": total_objects, "backend": "r2"}
            except Exception:
                return {"total_bytes": 0, "total_objects": 0, "backend": "r2_error"}
        else:
            base = cfg.get("UPLOAD_FOLDER", "uploads")
            total_size = total_objects = 0
            if os.path.exists(base):
                for root, _, files in os.walk(base):
                    for fn in files:
                        total_size += os.path.getsize(os.path.join(root, fn))
                        total_objects += 1
            return {"total_bytes": total_size, "total_objects": total_objects, "backend": "local"}


def compute_checksum(file_obj) -> str:
    sha256 = hashlib.sha256()
    file_obj.seek(0)
    for chunk in iter(lambda: file_obj.read(8192), b""):
        sha256.update(chunk)
    file_obj.seek(0)
    return sha256.hexdigest()


# Singleton instance
storage_service = StorageService()
