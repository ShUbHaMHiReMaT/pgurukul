"""User model — authentication, roles, profiles."""
import uuid
from datetime import datetime
from flask_login import UserMixin
from app import db


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id           = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username     = db.Column(db.String(50),  unique=True, nullable=False, index=True)
    email        = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash= db.Column(db.String(512), nullable=False)
    role         = db.Column(db.String(20),  nullable=False, default="intern")
    # roles: super_admin | department_lead | intern

    department_id = db.Column(
        db.String(36),
        db.ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )

    display_name = db.Column(db.String(100), nullable=True)
    bio          = db.Column(db.Text,        nullable=True)
    avatar_url   = db.Column(db.String(500), nullable=True)

    is_active    = db.Column(db.Boolean, default=True,  nullable=False)
    is_verified  = db.Column(db.Boolean, default=False, nullable=False)

    # Security
    failed_login_attempts = db.Column(db.Integer,  default=0, nullable=False)
    locked_until          = db.Column(db.DateTime, nullable=True)
    last_login_at         = db.Column(db.DateTime, nullable=True)
    last_login_ip         = db.Column(db.String(45), nullable=True)
    last_seen_at          = db.Column(db.DateTime, nullable=True)

    reset_token         = db.Column(db.String(255), nullable=True)
    reset_token_expires = db.Column(db.DateTime,    nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ─── Relationships ────────────────────────────────────────────────────────
    department = db.relationship(
        "Department",
        back_populates="members",
        foreign_keys=[department_id],
    )
    messages = db.relationship(
        "Message", back_populates="sender", cascade="all, delete-orphan"
    )
    sent_mentions = db.relationship(
        "Mention", foreign_keys="Mention.mentioned_by_id", back_populates="mentioned_by"
    )
    received_mentions = db.relationship(
        "Mention", foreign_keys="Mention.mentioned_user_id", back_populates="mentioned_user"
    )
    # IMPORTANT: specify foreign_keys to resolve ambiguity (Notification has 2 FKs to users)
    notifications = db.relationship(
        "Notification",
        foreign_keys="Notification.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    tasks_assigned = db.relationship(
        "TaskAssignment", back_populates="user", cascade="all, delete-orphan"
    )
    uploaded_files = db.relationship(
        "File", back_populates="uploader", foreign_keys="File.uploader_id"
    )
    activity_logs = db.relationship(
        "ActivityLog", back_populates="user", cascade="all, delete-orphan"
    )

    # ─── Properties ───────────────────────────────────────────────────────────
    @property
    def is_super_admin(self) -> bool:
        return self.role == "super_admin"

    @property
    def is_department_lead(self) -> bool:
        return self.role == "department_lead"

    @property
    def is_intern(self) -> bool:
        return self.role == "intern"

    @property
    def is_locked(self) -> bool:
        return bool(self.locked_until and self.locked_until > datetime.utcnow())

    @property
    def online(self) -> bool:
        if not self.last_seen_at:
            return False
        return (datetime.utcnow() - self.last_seen_at).total_seconds() < 180

    def get_id(self) -> str:
        return str(self.id)

    def to_dict(self, public: bool = True) -> dict:
        data = {
            "id":           self.id,
            "username":     self.username,
            "display_name": self.display_name or self.username,
            "role":         self.role,
            "avatar_url":   self.avatar_url,
            "online":       self.online,
            "department_id":self.department_id,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }
        if not public:
            data.update({
                "email":                  self.email,
                "is_active":              self.is_active,
                "last_login_at":          self.last_login_at.isoformat() if self.last_login_at else None,
                "last_login_ip":          self.last_login_ip,
                "failed_login_attempts":  self.failed_login_attempts,
                "is_locked":              self.is_locked,
            })
        return data

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.role})>"
