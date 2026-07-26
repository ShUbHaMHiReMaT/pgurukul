"""Task and TaskAssignment models."""
import uuid
from datetime import datetime
from app import db

TASK_STATUSES = ["not_started", "in_progress", "review", "completed"]
TASK_PRIORITIES = ["low", "medium", "high", "urgent"]


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="not_started", nullable=False, index=True)
    priority = db.Column(db.String(20), default="medium", nullable=False)

    due_date = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ─── Relationships ────────────────────────────────────────────────────
    department = db.relationship("Department", back_populates="tasks")
    created_by = db.relationship("User", foreign_keys=[created_by_id])
    assignments = db.relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")
    comments = db.relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    attachments = db.relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan")

    @property
    def assignees(self):
        return [a.user for a in self.assignments if a.user]

    @property
    def is_overdue(self) -> bool:
        if self.due_date and self.status != "completed":
            return datetime.utcnow() > self.due_date
        return False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "department_id": self.department_id,
            "created_by_id": self.created_by_id,
            "created_by_name": (self.created_by.display_name or self.created_by.username) if self.created_by else None,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "is_overdue": self.is_overdue,
            "assignees": [
                {"id": u.id, "username": u.username, "avatar_url": u.avatar_url}
                for u in self.assignees
            ],
            "comment_count": len(self.comments),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<Task {self.title[:30]} [{self.status}]>"


class TaskAssignment(db.Model):
    __tablename__ = "task_assignments"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = db.Column(db.String(36), db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (db.UniqueConstraint("task_id", "user_id", name="uq_task_user"),)

    task = db.relationship("Task", back_populates="assignments")
    user = db.relationship("User", back_populates="tasks_assigned")


class TaskComment(db.Model):
    __tablename__ = "task_comments"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = db.Column(db.String(36), db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    author_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    task = db.relationship("Task", back_populates="comments")
    author = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "author_id": self.author_id,
            "author_name": (self.author.display_name or self.author.username) if self.author else None,
            "author_avatar": self.author.avatar_url if self.author else None,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
        }


class TaskAttachment(db.Model):
    __tablename__ = "task_attachments"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = db.Column(db.String(36), db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    file_id = db.Column(db.String(36), db.ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    task = db.relationship("Task", back_populates="attachments")
    file = db.relationship("File")
