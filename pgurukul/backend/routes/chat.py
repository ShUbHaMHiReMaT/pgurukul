"""Chat routes — real-time messaging via SSE."""
import json
from datetime import datetime, timedelta
from flask import (
    Blueprint, render_template, request, jsonify, Response,
    abort, stream_with_context, current_app
)
from flask_login import login_required, current_user

from app import db
from backend.models.department import Department
from backend.models.message import Message, Mention, MessageReadReceipt, TypingIndicator
from backend.models.user import User
from backend.services.notification_service import notify_mention, notify_new_message, get_unread_count
from backend.services.activity_service import log_activity
from backend.utils.validators import sanitize_text
from backend.middleware.auth_required import department_access_required

chat_bp = Blueprint("chat", __name__)


def _get_dept_or_403(dept_id: str) -> Department:
    dept = Department.query.get(dept_id)
    if not dept:
        abort(404)
    if not current_user.is_super_admin and current_user.department_id != dept_id:
        abort(403)
    return dept


@chat_bp.route("/<dept_id>")
@login_required
def chat_view(dept_id: str):
    dept = _get_dept_or_403(dept_id)
    members = dept.members
    messages = (
        Message.query
        .filter_by(department_id=dept_id, is_deleted=False)
        .order_by(Message.created_at.asc())
        .limit(100)
        .all()
    )
    pinned = Message.query.filter_by(department_id=dept_id, is_pinned=True, is_deleted=False).all()

    return render_template(
        "dashboard/chat.html",
        dept=dept,
        members=members,
        messages=messages,
        pinned=pinned,
        unread_count=get_unread_count(current_user.id),
    )


@chat_bp.route("/<dept_id>/messages", methods=["GET"])
@login_required
def get_messages(dept_id: str):
    _get_dept_or_403(dept_id)
    before_id = request.args.get("before")
    limit = min(int(request.args.get("limit", 50)), 100)

    q = Message.query.filter_by(department_id=dept_id, is_deleted=False)
    if before_id:
        ref = Message.query.get(before_id)
        if ref:
            q = q.filter(Message.created_at < ref.created_at)

    msgs = q.order_by(Message.created_at.desc()).limit(limit).all()
    msgs.reverse()
    return jsonify({"messages": [m.to_dict(current_user.id) for m in msgs]})


@chat_bp.route("/<dept_id>/send", methods=["POST"])
@login_required
def send_message(dept_id: str):
    dept = _get_dept_or_403(dept_id)
    data = request.get_json(silent=True) or {}
    content = sanitize_text(data.get("content", ""), 5000)
    parent_id = data.get("parent_id")
    file_id = data.get("file_id")

    if not content and not file_id:
        return jsonify({"error": "Message content required."}), 400

    msg = Message(
        department_id=dept_id,
        sender_id=current_user.id,
        content=content,
        parent_id=parent_id,
        file_id=file_id,
    )
    db.session.add(msg)
    db.session.flush()

    # Parse @mentions
    import re
    mentioned_usernames = re.findall(r"@([a-zA-Z0-9_.-]+)", content)
    mentioned_user_ids = set()
    for uname in set(mentioned_usernames):
        user = User.query.filter_by(username=uname, department_id=dept_id).first()
        if user and user.id != current_user.id:
            mentioned_user_ids.add(user.id)
            mention = Mention(
                message_id=msg.id,
                mentioned_user_id=user.id,
                mentioned_by_id=current_user.id,
            )
            db.session.add(mention)
            notify_mention(
                mentioned_user_id=user.id,
                actor_id=current_user.id,
                actor_username=current_user.username,
                message_id=msg.id,
                department_id=dept_id,
            )

    # Notify other department members (mentioned users already got a mention notification)
    if content:
        for member in dept.members:
            if member.id == current_user.id or member.id in mentioned_user_ids:
                continue
            notify_new_message(
                user_id=member.id,
                actor_id=current_user.id,
                actor_username=current_user.username,
                message_id=msg.id,
                content_preview=content,
                department_id=dept_id,
            )

    db.session.commit()

    log_activity(
        user_id=current_user.id,
        department_id=dept_id,
        action="message_sent",
        resource_type="message",
        resource_id=msg.id,
    )

    return jsonify({"message": msg.to_dict(current_user.id)}), 201


@chat_bp.route("/<dept_id>/messages/<msg_id>/delete", methods=["POST"])
@login_required
def delete_message(dept_id: str, msg_id: str):
    _get_dept_or_403(dept_id)
    msg = Message.query.filter_by(id=msg_id, department_id=dept_id).first_or_404()

    # Only sender or dept lead/admin can delete
    if msg.sender_id != current_user.id and not current_user.is_super_admin and not current_user.is_department_lead:
        return jsonify({"error": "Not authorized."}), 403

    msg.is_deleted = True
    db.session.commit()

    log_activity(
        user_id=current_user.id,
        department_id=dept_id,
        action="message_deleted",
        resource_type="message",
        resource_id=msg_id,
    )
    return jsonify({"ok": True})


@chat_bp.route("/<dept_id>/messages/<msg_id>/pin", methods=["POST"])
@login_required
def pin_message(dept_id: str, msg_id: str):
    _get_dept_or_403(dept_id)
    if not current_user.is_super_admin and not current_user.is_department_lead:
        return jsonify({"error": "Not authorized."}), 403

    msg = Message.query.filter_by(id=msg_id, department_id=dept_id).first_or_404()
    msg.is_pinned = not msg.is_pinned
    db.session.commit()

    log_activity(
        user_id=current_user.id,
        department_id=dept_id,
        action="message_pinned",
        resource_type="message",
        resource_id=msg_id,
    )
    return jsonify({"pinned": msg.is_pinned})


@chat_bp.route("/<dept_id>/typing", methods=["POST"])
@login_required
def update_typing(dept_id: str):
    _get_dept_or_403(dept_id)
    ti = TypingIndicator.query.filter_by(department_id=dept_id, user_id=current_user.id).first()
    if not ti:
        ti = TypingIndicator(department_id=dept_id, user_id=current_user.id)
        db.session.add(ti)
    ti.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok": True})


@chat_bp.route("/<dept_id>/typing-users")
@login_required
def typing_users(dept_id: str):
    _get_dept_or_403(dept_id)
    cutoff = datetime.utcnow() - timedelta(seconds=4)
    typing = (
        TypingIndicator.query
        .filter(
            TypingIndicator.department_id == dept_id,
            TypingIndicator.user_id != current_user.id,
            TypingIndicator.updated_at >= cutoff,
        )
        .all()
    )
    return jsonify({
        "typing": [
            {"username": t.user.username, "display_name": t.user.display_name or t.user.username}
            for t in typing if t.user
        ]
    })


@chat_bp.route("/<dept_id>/online-users")
@login_required
def online_users(dept_id: str):
    dept = _get_dept_or_403(dept_id)
    return jsonify({
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "display_name": u.display_name or u.username,
                "avatar_url": u.avatar_url,
                "online": u.online,
            }
            for u in dept.members
        ]
    })


@chat_bp.route("/<dept_id>/poll")
@login_required
def poll_messages(dept_id: str):
    """Long-polling endpoint — returns new messages since `since` timestamp."""
    _get_dept_or_403(dept_id)
    since_ts = request.args.get("since")
    try:
        since = datetime.fromisoformat(since_ts) if since_ts else datetime.utcnow() - timedelta(seconds=5)
    except ValueError:
        since = datetime.utcnow() - timedelta(seconds=5)

    msgs = (
        Message.query
        .filter(
            Message.department_id == dept_id,
            Message.is_deleted == False,
            Message.created_at > since,
        )
        .order_by(Message.created_at.asc())
        .limit(50)
        .all()
    )

    # Update last seen
    current_user.last_seen_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        "messages": [m.to_dict(current_user.id) for m in msgs],
        "server_time": datetime.utcnow().isoformat(),
    })


@chat_bp.route("/<dept_id>/members/autocomplete")
@login_required
def member_autocomplete(dept_id: str):
    """Return members matching a prefix — used by @mention autocomplete."""
    _get_dept_or_403(dept_id)
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"users": []})

    users = (
        User.query
        .filter(
            User.department_id == dept_id,
            User.is_active == True,
            db.or_(
                User.username.ilike(f"{q}%"),
                User.display_name.ilike(f"{q}%"),
            ),
        )
        .limit(10)
        .all()
    )
    return jsonify({
        "users": [
            {"username": u.username, "display_name": u.display_name or u.username, "avatar_url": u.avatar_url}
            for u in users
        ]
    })
