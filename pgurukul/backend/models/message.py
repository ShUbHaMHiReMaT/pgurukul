"""Message model for department chat."""
import uuid
from datetime import datetime
from app import db


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default="text", nullable=False)
    # types: text | file | image | system

    parent_id = db.Column(db.String(36), db.ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)

    # File attachment (for type=file/image)
    file_id = db.Column(db.String(36), db.ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    file_url = db.Column(db.String(1000), nullable=True)
    file_name = db.Column(db.String(255), nullable=True)

    is_pinned = db.Column(db.Boolean, default=False, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    edited_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    # ─── Relationships ────────────────────────────────────────────────────
    department = db.relationship("Department", back_populates="messages")
    sender = db.relationship("User", back_populates="messages")
    mentions = db.relationship("Mention", back_populates="message", cascade="all, delete-orphan")
    replies = db.relationship("Message", backref=db.backref("parent", remote_side=[id]))
    read_receipts = db.relationship("MessageReadReceipt", back_populates="message", cascade="all, delete-orphan")
    file = db.relationship("File", foreign_keys=[file_id])

    def to_dict(self, current_user_id: str = None) -> dict:
        data = {
            "id": self.id,
            "department_id": self.department_id,
            "sender_id": self.sender_id,
            "sender_username": self.sender.username if self.sender else None,
            "sender_display_name": (self.sender.display_name or self.sender.username) if self.sender else None,
            "sender_avatar": self.sender.avatar_url if self.sender else None,
            "content": self.content if not self.is_deleted else "[Message deleted]",
            "message_type": self.message_type,
            "parent_id": self.parent_id,
            "file_url": self.file_url,
            "file_name": self.file_name,
            "is_pinned": self.is_pinned,
            "is_deleted": self.is_deleted,
            "edited_at": self.edited_at.isoformat() if self.edited_at else None,
            "created_at": self.created_at.isoformat(),
            "mentions": [m.mentioned_user.username for m in self.mentions if m.mentioned_user],
            "reply_count": len(self.replies) if self.replies else 0,
        }
        if self.parent and not self.parent.is_deleted:
            data["parent_preview"] = {
                "id": self.parent.id,
                "sender": self.parent.sender.username if self.parent.sender else None,
                "content": self.parent.content[:100],
            }
        return data

    def __repr__(self) -> str:
        return f"<Message {self.id[:8]} by {self.sender_id[:8]}>"


class Mention(db.Model):
    __tablename__ = "mentions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = db.Column(db.String(36), db.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    mentioned_user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mentioned_by_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    message = db.relationship("Message", back_populates="mentions")
    mentioned_user = db.relationship("User", foreign_keys=[mentioned_user_id], back_populates="received_mentions")
    mentioned_by = db.relationship("User", foreign_keys=[mentioned_by_id], back_populates="sent_mentions")


class MessageReadReceipt(db.Model):
    __tablename__ = "message_read_receipts"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = db.Column(db.String(36), db.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    read_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (db.UniqueConstraint("message_id", "user_id", name="uq_message_user_read"),)

    message = db.relationship("Message", back_populates="read_receipts")
    user = db.relationship("User")


class TypingIndicator(db.Model):
    __tablename__ = "typing_indicators"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("department_id", "user_id", name="uq_dept_user_typing"),)

    user = db.relationship("User")
