"""Models package — import all for SQLAlchemy to register."""
from .user import User
from .department import Department
from .message import Message, Mention, MessageReadReceipt, TypingIndicator
from .file import File, FileVersion
from .task import Task, TaskAssignment, TaskComment, TaskAttachment
from .announcement import Announcement, AnnouncementRead, Notification, ActivityLog

__all__ = [
    "User", "Department",
    "Message", "Mention", "MessageReadReceipt", "TypingIndicator",
    "File", "FileVersion",
    "Task", "TaskAssignment", "TaskComment", "TaskAttachment",
    "Announcement", "AnnouncementRead", "Notification", "ActivityLog",
]
