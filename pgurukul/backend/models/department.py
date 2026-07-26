"""Department model."""
import uuid
import secrets
from datetime import datetime
from app import db

DEPARTMENT_CHOICES = [
    "Research", "Marketing", "Software", "Hardware",
    "AI", "Finance", "Legal", "Operations", "Design",
]


class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False, unique=True)
    slug = db.Column(db.String(100), nullable=False, unique=True, index=True)
    description = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(10), nullable=True, default="🏢")

    invite_code = db.Column(db.String(20), nullable=False, unique=True, default=lambda: secrets.token_urlsafe(10))
    temp_password = db.Column(db.String(255), nullable=True)  # Hashed initial password

    lead_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    is_active = db.Column(db.Boolean, default=True, nullable=False)
    storage_used_bytes = db.Column(db.BigInteger, default=0, nullable=False)
    storage_limit_bytes = db.Column(db.BigInteger, default=10 * 1024 * 1024 * 1024, nullable=False)  # 10 GB

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ─── Relationships ────────────────────────────────────────────────────
    lead = db.relationship("User", foreign_keys=[lead_id])
    members = db.relationship("User", back_populates="department", foreign_keys="User.department_id")
    messages = db.relationship("Message", back_populates="department", cascade="all, delete-orphan")
    files = db.relationship("File", back_populates="department", cascade="all, delete-orphan")
    tasks = db.relationship("Task", back_populates="department", cascade="all, delete-orphan")
    announcements = db.relationship("Announcement", back_populates="department")
    activity_logs = db.relationship("ActivityLog", back_populates="department", cascade="all, delete-orphan")

    @property
    def member_count(self) -> int:
        return len(self.members)

    @property
    def storage_used_mb(self) -> float:
        return round(self.storage_used_bytes / (1024 * 1024), 2)

    @property
    def storage_limit_gb(self) -> float:
        return round(self.storage_limit_bytes / (1024 * 1024 * 1024), 2)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "icon": self.icon,
            "invite_code": self.invite_code,
            "lead_id": self.lead_id,
            "member_count": self.member_count,
            "is_active": self.is_active,
            "storage_used_bytes": self.storage_used_bytes,
            "storage_limit_bytes": self.storage_limit_bytes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return f"<Department {self.name}>"
