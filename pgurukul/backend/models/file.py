"""File and FileVersion models."""
import uuid
from datetime import datetime
from app import db


class File(db.Model):
    __tablename__ = "files"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    uploader_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    extension = db.Column(db.String(20), nullable=False)
    mime_type = db.Column(db.String(100), nullable=True)
    size_bytes = db.Column(db.BigInteger, nullable=False, default=0)

    # Storage
    storage_key = db.Column(db.String(1000), nullable=False)  # R2 key or local path
    storage_url = db.Column(db.String(2000), nullable=True)   # Public URL
    storage_backend = db.Column(db.String(20), default="local", nullable=False)  # r2 | local

    # Versioning
    version = db.Column(db.Integer, nullable=False, default=1)
    current_version_id = db.Column(db.String(36), nullable=True)  # Points to current FileVersion

    # Metadata
    checksum = db.Column(db.String(64), nullable=True)  # SHA-256
    description = db.Column(db.Text, nullable=True)
    folder_path = db.Column(db.String(500), default="/", nullable=False, index=True)
    tags = db.Column(db.Text, nullable=True)  # JSON array of tags

    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    is_favorite = db.Column(db.Boolean, default=False, nullable=False)

    # Full-text search
    search_vector = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ─── Relationships ────────────────────────────────────────────────────
    department = db.relationship("Department", back_populates="files")
    uploader = db.relationship("User", back_populates="uploaded_files", foreign_keys=[uploader_id])
    versions = db.relationship("FileVersion", back_populates="file", cascade="all, delete-orphan", order_by="FileVersion.version_number.desc()")

    @property
    def size_mb(self) -> float:
        return round(self.size_bytes / (1024 * 1024), 2)

    @property
    def is_image(self) -> bool:
        return self.extension.lower() in {"png", "jpg", "jpeg", "gif", "webp", "svg"}

    @property
    def is_pdf(self) -> bool:
        return self.extension.lower() == "pdf"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "original_name": self.original_name,
            "extension": self.extension,
            "mime_type": self.mime_type,
            "size_bytes": self.size_bytes,
            "size_mb": self.size_mb,
            "storage_url": self.storage_url,
            "version": self.version,
            "checksum": self.checksum,
            "description": self.description,
            "folder_path": self.folder_path,
            "is_deleted": self.is_deleted,
            "is_favorite": self.is_favorite,
            "is_image": self.is_image,
            "is_pdf": self.is_pdf,
            "department_id": self.department_id,
            "uploader_id": self.uploader_id,
            "uploader_name": (self.uploader.display_name or self.uploader.username) if self.uploader else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "version_count": len(self.versions),
        }

    def __repr__(self) -> str:
        return f"<File {self.name} v{self.version}>"


class FileVersion(db.Model):
    __tablename__ = "file_versions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = db.Column(db.String(36), db.ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    uploader_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    version_number = db.Column(db.Integer, nullable=False)
    storage_key = db.Column(db.String(1000), nullable=False)
    storage_url = db.Column(db.String(2000), nullable=True)
    size_bytes = db.Column(db.BigInteger, nullable=False)
    checksum = db.Column(db.String(64), nullable=True)
    change_note = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # ─── Relationships ────────────────────────────────────────────────────
    file = db.relationship("File", back_populates="versions")
    uploader = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "file_id": self.file_id,
            "version_number": self.version_number,
            "storage_url": self.storage_url,
            "size_bytes": self.size_bytes,
            "checksum": self.checksum,
            "change_note": self.change_note,
            "uploader_id": self.uploader_id,
            "uploader_name": (self.uploader.display_name or self.uploader.username) if self.uploader else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
