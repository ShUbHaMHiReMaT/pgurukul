"""File management service."""
import os
from typing import Optional, Tuple, List
from werkzeug.datastructures import FileStorage
from flask import current_app

from app import db
from backend.models.file import File, FileVersion
from backend.models.department import Department
from backend.services.storage_service import storage_service, compute_checksum
from backend.services.activity_service import log_activity

ALLOWED_EXTENSIONS = {
    "pdf", "docx", "doc", "pptx", "ppt",
    "png", "jpg", "jpeg", "gif", "webp", "svg",
    "zip", "tar", "gz",
    "csv", "xlsx", "xls",
    "txt", "md", "mp4", "mov",
}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[-1].lower() in ALLOWED_EXTENSIONS


def upload_file(
    file: FileStorage,
    department_id: str,
    uploader_id: str,
    folder_path: str = "/",
    description: str = "",
    change_note: str = "",
) -> Tuple[Optional[File], Optional[str]]:
    """
    Upload a file, creating versioning automatically.
    If a file with the same name exists in the folder, create a new version.
    Returns (file_record, error_message).
    """
    if not file or not file.filename:
        return None, "No file provided."

    filename = file.filename.strip()
    if not allowed_file(filename):
        return None, f"File type not allowed: {filename.rsplit('.', 1)[-1] if '.' in filename else 'unknown'}"

    # Security: strip path from filename
    filename = os.path.basename(filename)
    ext = filename.rsplit(".", 1)[-1].lower()
    mime_type = file.content_type or "application/octet-stream"

    # Compute checksum
    checksum = compute_checksum(file)
    file.seek(0)

    # Check department storage limit
    dept = Department.query.get(department_id)
    if not dept:
        return None, "Department not found."

    try:
        storage_key, storage_url, size_bytes = storage_service.upload_file(
            file, filename, department_id, mime_type
        )
    except Exception as e:
        current_app.logger.error(f"Upload failed: {e}")
        return None, "File upload failed. Please try again."

    # Check if file with same name exists (for versioning)
    existing = File.query.filter_by(
        department_id=department_id,
        name=filename,
        folder_path=folder_path,
        is_deleted=False,
    ).first()

    if existing:
        # Create new version
        new_version_num = existing.version + 1
        fv = FileVersion(
            file_id=existing.id,
            uploader_id=uploader_id,
            version_number=new_version_num,
            storage_key=storage_key,
            storage_url=storage_url,
            size_bytes=size_bytes,
            checksum=checksum,
            change_note=change_note or f"Version {new_version_num}",
        )
        db.session.add(fv)

        existing.version = new_version_num
        existing.storage_key = storage_key
        existing.storage_url = storage_url
        existing.size_bytes = size_bytes
        existing.checksum = checksum
        existing.current_version_id = None  # will be set after flush

        db.session.flush()
        existing.current_version_id = fv.id

        # Update department storage usage
        dept.storage_used_bytes = max(0, dept.storage_used_bytes - existing.size_bytes + size_bytes)
        db.session.commit()

        log_activity(
            user_id=uploader_id,
            department_id=department_id,
            action="file_uploaded",
            resource_type="file",
            resource_id=existing.id,
            details=f"New version {new_version_num} of {filename}",
        )
        return existing, None
    else:
        # First version
        f_record = File(
            department_id=department_id,
            uploader_id=uploader_id,
            name=filename,
            original_name=filename,
            extension=ext,
            mime_type=mime_type,
            size_bytes=size_bytes,
            storage_key=storage_key,
            storage_url=storage_url,
            storage_backend="r2" if current_app.config.get("USE_R2_STORAGE") else "local",
            version=1,
            checksum=checksum,
            description=description,
            folder_path=folder_path,
        )
        db.session.add(f_record)
        db.session.flush()

        fv = FileVersion(
            file_id=f_record.id,
            uploader_id=uploader_id,
            version_number=1,
            storage_key=storage_key,
            storage_url=storage_url,
            size_bytes=size_bytes,
            checksum=checksum,
            change_note=change_note or "Initial upload",
        )
        db.session.add(fv)
        db.session.flush()
        f_record.current_version_id = fv.id

        dept.storage_used_bytes = (dept.storage_used_bytes or 0) + size_bytes
        db.session.commit()

        log_activity(
            user_id=uploader_id,
            department_id=department_id,
            action="file_uploaded",
            resource_type="file",
            resource_id=f_record.id,
            details=f"Uploaded {filename} ({size_bytes} bytes)",
        )
        return f_record, None


def delete_file(
    file_id: str,
    user_id: str,
    department_id: str,
    permanent: bool = False,
) -> Optional[str]:
    """Soft-delete (or permanent delete) a file. Returns error or None."""
    f = File.query.filter_by(id=file_id, department_id=department_id, is_deleted=False).first()
    if not f:
        return "File not found."

    if permanent:
        storage_service.delete_file(f.storage_key)
        dept = Department.query.get(department_id)
        if dept:
            dept.storage_used_bytes = max(0, dept.storage_used_bytes - f.size_bytes)
        db.session.delete(f)
    else:
        f.is_deleted = True

    db.session.commit()
    log_activity(
        user_id=user_id,
        department_id=department_id,
        action="file_deleted",
        resource_type="file",
        resource_id=file_id,
        details=f"{'Permanently' if permanent else 'Soft'} deleted: {f.name}",
    )
    return None


def rename_file(file_id: str, new_name: str, user_id: str, department_id: str) -> Optional[str]:
    """Rename a file. Returns error or None."""
    f = File.query.filter_by(id=file_id, department_id=department_id, is_deleted=False).first()
    if not f:
        return "File not found."
    old_name = f.name
    f.name = new_name.strip()
    db.session.commit()
    log_activity(
        user_id=user_id,
        department_id=department_id,
        action="file_renamed",
        resource_type="file",
        resource_id=file_id,
        details=f"Renamed from '{old_name}' to '{f.name}'",
    )
    return None


def restore_version(
    file_id: str,
    version_id: str,
    user_id: str,
    department_id: str,
) -> Tuple[Optional[File], Optional[str]]:
    """Restore a file to a previous version."""
    f = File.query.filter_by(id=file_id, department_id=department_id).first()
    if not f:
        return None, "File not found."

    v = FileVersion.query.filter_by(id=version_id, file_id=file_id).first()
    if not v:
        return None, "Version not found."

    # Create a new version entry pointing to the restored state
    new_v_num = f.version + 1
    new_v = FileVersion(
        file_id=f.id,
        uploader_id=user_id,
        version_number=new_v_num,
        storage_key=v.storage_key,
        storage_url=v.storage_url,
        size_bytes=v.size_bytes,
        checksum=v.checksum,
        change_note=f"Restored from version {v.version_number}",
    )
    db.session.add(new_v)

    f.version = new_v_num
    f.storage_key = v.storage_key
    f.storage_url = v.storage_url
    f.size_bytes = v.size_bytes
    f.checksum = v.checksum
    db.session.flush()
    f.current_version_id = new_v.id

    db.session.commit()

    log_activity(
        user_id=user_id,
        department_id=department_id,
        action="file_restored",
        resource_type="file",
        resource_id=file_id,
        details=f"Restored '{f.name}' to version {v.version_number}",
    )
    return f, None
