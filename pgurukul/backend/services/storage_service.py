"""Storage service — Cloudflare R2 or local fallback."""
import os
import uuid
import hashlib
from typing import Optional, Tuple
from flask import current_app

try:
    import boto3
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


class StorageService:
    """Unified storage interface for R2 or local disk."""

    def __init__(self, app=None):
        self._client = None
        self._app = app

    def _get_r2_client(self):
        if self._client is None:
            cfg = current_app.config
            self._client = boto3.client(
                "s3",
                endpoint_url=f"https://{cfg['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
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
        Returns (storage_key, storage_url, size_bytes).
        """
        cfg = current_app.config
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        unique_key = f"departments/{department_id}/{uuid.uuid4().hex}.{ext}"

        # Read content and measure size
        content = file_obj.read()
        size_bytes = len(content)
        file_obj.seek(0)

        if cfg.get("USE_R2_STORAGE") and BOTO3_AVAILABLE:
            return self._upload_to_r2(content, unique_key, content_type, cfg, size_bytes)
        else:
            return self._upload_to_local(content, unique_key, size_bytes, cfg)

    def _upload_to_r2(self, content: bytes, key: str, content_type: str, cfg: dict, size: int) -> Tuple[str, str, int]:
        client = self._get_r2_client()
        try:
            client.put_object(
                Bucket=cfg["R2_BUCKET_NAME"],
                Key=key,
                Body=content,
                ContentType=content_type,
            )
            public_url = cfg.get("R2_PUBLIC_URL", "")
            url = f"{public_url}/{key}" if public_url else ""
            return key, url, size
        except Exception as e:
            current_app.logger.error(f"R2 upload failed: {e}")
            raise

    def _upload_to_local(self, content: bytes, key: str, size: int, cfg: dict) -> Tuple[str, str, int]:
        base = cfg["UPLOAD_FOLDER"]
        full_path = os.path.join(base, key.replace("/", os.sep))
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(content)
        url = f"/static/uploads/{key}"
        return key, url, size

    def delete_file(self, storage_key: str) -> bool:
        """Delete a file from storage. Returns True on success."""
        cfg = current_app.config
        if cfg.get("USE_R2_STORAGE") and BOTO3_AVAILABLE:
            try:
                client = self._get_r2_client()
                client.delete_object(Bucket=cfg["R2_BUCKET_NAME"], Key=storage_key)
                return True
            except Exception as e:
                current_app.logger.error(f"R2 delete failed: {e}")
                return False
        else:
            base = cfg["UPLOAD_FOLDER"]
            full_path = os.path.join(base, storage_key.replace("/", os.sep))
            try:
                if os.path.exists(full_path):
                    os.remove(full_path)
                return True
            except OSError as e:
                current_app.logger.error(f"Local delete failed: {e}")
                return False

    def get_presigned_url(self, storage_key: str, expires: int = 3600) -> Optional[str]:
        """Get a presigned URL for private R2 objects."""
        cfg = current_app.config
        if cfg.get("USE_R2_STORAGE") and BOTO3_AVAILABLE:
            try:
                client = self._get_r2_client()
                url = client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": cfg["R2_BUCKET_NAME"], "Key": storage_key},
                    ExpiresIn=expires,
                )
                return url
            except Exception as e:
                current_app.logger.error(f"Presign failed: {e}")
                return None
        return f"/static/uploads/{storage_key}"

    def get_storage_stats(self) -> dict:
        """Get overall storage statistics."""
        cfg = current_app.config
        if cfg.get("USE_R2_STORAGE") and BOTO3_AVAILABLE:
            try:
                client = self._get_r2_client()
                paginator = client.get_paginator("list_objects_v2")
                total_size = 0
                total_objects = 0
                for page in paginator.paginate(Bucket=cfg["R2_BUCKET_NAME"]):
                    for obj in page.get("Contents", []):
                        total_size += obj["Size"]
                        total_objects += 1
                return {"total_bytes": total_size, "total_objects": total_objects, "backend": "r2"}
            except Exception:
                return {"total_bytes": 0, "total_objects": 0, "backend": "r2"}
        else:
            base = cfg["UPLOAD_FOLDER"]
            total_size = 0
            total_objects = 0
            if os.path.exists(base):
                for root, _, files in os.walk(base):
                    for f in files:
                        total_size += os.path.getsize(os.path.join(root, f))
                        total_objects += 1
            return {"total_bytes": total_size, "total_objects": total_objects, "backend": "local"}


def compute_checksum(file_obj) -> str:
    """Compute SHA-256 checksum of file content."""
    sha256 = hashlib.sha256()
    file_obj.seek(0)
    for chunk in iter(lambda: file_obj.read(8192), b""):
        sha256.update(chunk)
    file_obj.seek(0)
    return sha256.hexdigest()


# Singleton
storage_service = StorageService()
