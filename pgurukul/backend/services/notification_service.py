"""Notification service."""
from typing import Optional
from app import db
from backend.models.announcement import Notification


def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    body: Optional[str] = None,
    actor_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    entity_url: Optional[str] = None,
) -> Notification:
    """Create and persist a notification for a user."""
    notif = Notification(
        user_id=user_id,
        actor_id=actor_id,
        notification_type=notification_type,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_url=entity_url,
    )
    db.session.add(notif)
    db.session.commit()
    return notif


def notify_mention(
    mentioned_user_id: str,
    actor_id: str,
    actor_username: str,
    message_id: str,
    department_id: str,
) -> Notification:
    return create_notification(
        user_id=mentioned_user_id,
        notification_type="mention",
        title=f"@{actor_username} mentioned you",
        body="You were mentioned in a message",
        actor_id=actor_id,
        entity_type="message",
        entity_id=message_id,
        entity_url=f"/chat/{department_id}",
    )


def notify_task_assigned(
    assignee_id: str,
    actor_id: str,
    actor_username: str,
    task_id: str,
    task_title: str,
    department_id: str,
) -> Notification:
    return create_notification(
        user_id=assignee_id,
        notification_type="task_assigned",
        title=f"Task assigned: {task_title[:50]}",
        body=f"{actor_username} assigned you to a task",
        actor_id=actor_id,
        entity_type="task",
        entity_id=task_id,
        entity_url=f"/tasks/{department_id}/{task_id}",
    )


def notify_new_message(
    user_id: str,
    actor_id: str,
    actor_username: str,
    message_id: str,
    content_preview: str,
    department_id: str,
) -> Notification:
    return create_notification(
        user_id=user_id,
        notification_type="new_message",
        title=f"{actor_username} sent a message",
        body=content_preview[:100],
        actor_id=actor_id,
        entity_type="message",
        entity_id=message_id,
        entity_url=f"/chat/{department_id}",
    )


def notify_announcement(
    user_id: str,
    actor_id: str,
    actor_username: str,
    announcement_id: str,
    title: str,
    department_id: Optional[str] = None,
) -> Notification:
    return create_notification(
        user_id=user_id,
        notification_type="announcement",
        title=f"New announcement: {title[:50]}",
        body=f"Posted by {actor_username}",
        actor_id=actor_id,
        entity_type="announcement",
        entity_id=announcement_id,
        entity_url=f"/dashboard/announcements/{department_id}" if department_id else "/dashboard/",
    )


def get_unread_count(user_id: str) -> int:
    return Notification.query.filter_by(user_id=user_id, is_read=False).count()


def mark_all_read(user_id: str) -> int:
    from datetime import datetime
    count = Notification.query.filter_by(user_id=user_id, is_read=False).update(
        {"is_read": True, "read_at": datetime.utcnow()}
    )
    db.session.commit()
    return count
