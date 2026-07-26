"""REST API routes — JSON endpoints for JS fetch calls."""
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from datetime import datetime

from app import db
from backend.models.user import User
from backend.models.department import Department
from backend.models.announcement import Notification
from backend.services.notification_service import get_unread_count, mark_all_read

api_bp = Blueprint("api", __name__)


@api_bp.route("/me")
@login_required
def me():
    # Update last seen
    current_user.last_seen_at = datetime.utcnow()
    db.session.commit()
    return jsonify({
        "user": current_user.to_dict(public=False),
        "department": current_user.department.to_dict() if current_user.department else None,
        "unread_notifications": get_unread_count(current_user.id),
    })


@api_bp.route("/notifications")
@login_required
def get_notifications():
    limit = min(50, int(request.args.get("limit", 20)))
    notifs = (
        Notification.query
        .filter_by(user_id=current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify({
        "notifications": [n.to_dict() for n in notifs],
        "unread_count": get_unread_count(current_user.id),
    })


@api_bp.route("/notifications/<notif_id>/read", methods=["POST"])
@login_required
def mark_notification_read(notif_id: str):
    notif = Notification.query.filter_by(id=notif_id, user_id=current_user.id).first_or_404()
    notif.mark_read()
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.route("/notifications/read-all", methods=["POST"])
@login_required
def mark_all_notifications_read():
    count = mark_all_read(current_user.id)
    return jsonify({"marked": count})


@api_bp.route("/departments")
@login_required
def list_departments():
    if current_user.is_super_admin:
        depts = Department.query.filter_by(is_active=True).all()
    else:
        depts = [current_user.department] if current_user.department else []
    return jsonify({"departments": [d.to_dict() for d in depts if d]})


@api_bp.route("/users/search")
@login_required
def search_users():
    """Search users within the same department (for task assignment etc.)."""
    q = request.args.get("q", "")
    dept_id = current_user.department_id

    if not dept_id and not current_user.is_super_admin:
        return jsonify({"users": []})

    query = User.query.filter(
        User.is_active == True,
        db.or_(
            User.username.ilike(f"{q}%"),
            User.display_name.ilike(f"{q}%"),
        ),
    )
    if not current_user.is_super_admin:
        query = query.filter_by(department_id=dept_id)

    users = query.limit(10).all()
    return jsonify({"users": [u.to_dict() for u in users]})


@api_bp.route("/ping")
def ping():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})
