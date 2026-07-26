"""Announcement, Notification, and ActivityLog models."""
import uuid
from datetime import datetime
from app import db


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    author_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)
    # NULL department_id = global announcement

    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_global = db.Column(db.Boolean, default=False, nullable=False)
    is_pinned = db.Column(db.Boolean, default=False, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ─── Relationships ────────────────────────────────────────────────────
    author = db.relationship("User")
    department = db.relationship("Department", back_populates="announcements")
    reads = db.relationship("AnnouncementRead", back_populates="announcement", cascade="all, delete-orphan")

    def is_read_by(self, user_id: str) -> bool:
        return any(r.user_id == user_id for r in self.reads)

    def to_dict(self, current_user_id: str = None) -> dict:
        return {
            "id": self.id,
            "author_id": self.author_id,
            "author_name": (self.author.display_name or self.author.username) if self.author else None,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
            "title": self.title,
            "content": self.content,
            "is_global": self.is_global,
            "is_pinned": self.is_pinned,
            "is_read": self.is_read_by(current_user_id) if current_user_id else False,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<Announcement {self.title[:30]}>"


class AnnouncementRead(db.Model):
    __tablename__ = "announcement_reads"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    announcement_id = db.Column(db.String(36), db.ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    read_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (db.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_user_read"),)

    announcement = db.relationship("Announcement", back_populates="reads")
    user = db.relationship("User")


class Notification(db.Model):
    __tablename__ = "notifications"

    TYPES = ["mention", "task_assigned", "announcement", "file_shared", "task_completed", "system"]

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    notification_type = db.Column(db.String(30), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=True)

    # Reference to the related entity
    entity_type = db.Column(db.String(30), nullable=True)  # message | task | file | announcement
    entity_id = db.Column(db.String(36), nullable=True)
    entity_url = db.Column(db.String(500), nullable=True)

    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # ─── Relationships ────────────────────────────────────────────────────
    user = db.relationship("User", foreign_keys=[user_id], back_populates="notifications")
    actor = db.relationship("User", foreign_keys=[actor_id])

    def mark_read(self) -> None:
        self.is_read = True
        self.read_at = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "actor_id": self.actor_id,
            "actor_name": (self.actor.display_name or self.actor.username) if self.actor else None,
            "actor_avatar": self.actor.avatar_url if self.actor else None,
            "type": self.notification_type,
            "title": self.title,
            "body": self.body,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "entity_url": self.entity_url,
            "is_read": self.is_read,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<Notification {self.notification_type} for {self.user_id[:8]}>"


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    ACTIONS = [
        "login", "logout", "login_failed", "password_changed", "password_reset",
        "profile_updated", "avatar_uploaded",
        "file_uploaded", "file_downloaded", "file_deleted", "file_renamed", "file_restored",
        "message_sent", "message_deleted", "message_pinned",
        "task_created", "task_updated", "task_completed", "task_assigned",
        "announcement_created", "announcement_deleted",
        "department_joined", "department_left",
        "user_created", "user_deleted", "user_disabled",
        "mention_sent", "mention_received",
        "admin_action",
    ]

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)

    action = db.Column(db.String(50), nullable=False, index=True)
    resource_type = db.Column(db.String(30), nullable=True)
    resource_id = db.Column(db.String(36), nullable=True)
    details = db.Column(db.Text, nullable=True)  # JSON string for extra info

    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    device_type = db.Column(db.String(30), nullable=True)
    browser = db.Column(db.String(50), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    # ─── Relationships ────────────────────────────────────────────────────
    user = db.relationship("User", back_populates="activity_logs")
    department = db.relationship("Department", back_populates="activity_logs")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": (self.user.username) if self.user else None,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "device_type": self.device_type,
            "browser": self.browser,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<ActivityLog {self.action} by {self.user_id}>"
