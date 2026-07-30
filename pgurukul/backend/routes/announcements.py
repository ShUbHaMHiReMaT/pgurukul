"""Announcements routes."""
from flask import Blueprint, render_template, request, jsonify, abort
from flask_login import login_required, current_user

from app import db
from backend.models.announcement import Announcement, AnnouncementRead
from backend.models.department import Department
from backend.models.user import User
from backend.services.notification_service import notify_announcement, get_unread_count
from backend.services.activity_service import log_activity
from backend.utils.validators import sanitize_text

announcements_bp = Blueprint("announcements", __name__)


def _check_dept(dept_id: str) -> Department:
    dept = Department.query.get(dept_id)
    if not dept:
        abort(404)
    if not current_user.is_super_admin and current_user.department_id != dept_id:
        abort(403)
    return dept


@announcements_bp.route("/<dept_id>")
@login_required
def announcements_view(dept_id: str):
    dept = _check_dept(dept_id)

    announcements = (
        Announcement.query
        .filter(
            Announcement.is_deleted == False,
            db.or_(
                Announcement.department_id == dept_id,
                Announcement.is_global == True,
            ),
        )
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .all()
    )

    return render_template(
        "dashboard/announcements.html",
        dept=dept,
        announcements=announcements,
        unread_count=get_unread_count(current_user.id),
        current_user_id=current_user.id,
    )


@announcements_bp.route("/<dept_id>/create", methods=["POST"])
@login_required
def create_announcement(dept_id: str):
    dept = _check_dept(dept_id)

    if not current_user.is_super_admin and not current_user.is_department_lead:
        return jsonify({"error": "Not authorized."}), 403

    data = request.get_json(silent=True) or {}
    title = sanitize_text(data.get("title", ""), 255)
    content = sanitize_text(data.get("content", ""), 10000)
    is_pinned = bool(data.get("is_pinned", False))
    is_global = bool(data.get("is_global", False)) and current_user.is_super_admin

    if not title or not content:
        return jsonify({"error": "Title and content are required."}), 400

    announcement = Announcement(
        author_id=current_user.id,
        department_id=None if is_global else dept_id,
        title=title,
        content=content,
        is_global=is_global,
        is_pinned=is_pinned,
    )
    db.session.add(announcement)
    db.session.flush()

    # Notify all department members
    target_dept = Department.query.get(dept_id) if not is_global else None
    members_to_notify = dept.members if not is_global else User.query.filter_by(is_active=True).all()
    for member in members_to_notify:
        if member.id != current_user.id:
            notify_announcement(
                user_id=member.id,
                actor_id=current_user.id,
                actor_username=current_user.username,
                announcement_id=announcement.id,
                title=title,
                department_id=None if is_global else dept_id,
            )

    db.session.commit()
    log_activity(
        user_id=current_user.id,
        department_id=dept_id if not is_global else None,
        action="announcement_created",
        resource_type="announcement",
        resource_id=announcement.id,
        details=f"{'Global' if is_global else 'Department'} announcement: {title}",
    )
    return jsonify({"announcement": announcement.to_dict(current_user.id)}), 201


@announcements_bp.route("/<dept_id>/<ann_id>/read", methods=["POST"])
@login_required
def mark_read(dept_id: str, ann_id: str):
    _check_dept(dept_id)
    announcement = Announcement.query.get_or_404(ann_id)

    existing = AnnouncementRead.query.filter_by(
        announcement_id=ann_id, user_id=current_user.id
    ).first()
    if not existing:
        read_record = AnnouncementRead(announcement_id=ann_id, user_id=current_user.id)
        db.session.add(read_record)
        db.session.commit()

    return jsonify({"ok": True})


@announcements_bp.route("/<dept_id>/<ann_id>/pin", methods=["POST"])
@login_required
def toggle_pin(dept_id: str, ann_id: str):
    _check_dept(dept_id)
    if not current_user.is_super_admin and not current_user.is_department_lead:
        return jsonify({"error": "Not authorized."}), 403

    ann = Announcement.query.filter_by(id=ann_id, department_id=dept_id).first_or_404()
    ann.is_pinned = not ann.is_pinned
    db.session.commit()
    return jsonify({"is_pinned": ann.is_pinned})


@announcements_bp.route("/<dept_id>/<ann_id>/delete", methods=["POST"])
@login_required
def delete_announcement(dept_id: str, ann_id: str):
    _check_dept(dept_id)
    if not current_user.is_super_admin and not current_user.is_department_lead:
        return jsonify({"error": "Not authorized."}), 403

    ann = Announcement.query.filter_by(id=ann_id, department_id=dept_id).first_or_404()
    ann.is_deleted = True
    db.session.commit()
    log_activity(
        user_id=current_user.id,
        department_id=dept_id,
        action="announcement_deleted",
        resource_type="announcement",
        resource_id=ann_id,
    )
    return jsonify({"ok": True})


@announcements_bp.route("/global/create", methods=["POST"])
@login_required
def create_global():
    """Super admin global announcement shortcut."""
    if not current_user.is_super_admin:
        return jsonify({"error": "Not authorized."}), 403

    data = request.get_json(silent=True) or {}
    title = sanitize_text(data.get("title", ""), 255)
    content = sanitize_text(data.get("content", ""), 10000)

    if not title or not content:
        return jsonify({"error": "Title and content required."}), 400

    ann = Announcement(
        author_id=current_user.id,
        department_id=None,
        title=title,
        content=content,
        is_global=True,
        is_pinned=bool(data.get("is_pinned", False)),
    )
    db.session.add(ann)
    db.session.flush()

    for user in User.query.filter_by(is_active=True).all():
        if user.id != current_user.id:
            notify_announcement(
                user_id=user.id,
                actor_id=current_user.id,
                actor_username=current_user.username,
                announcement_id=ann.id,
                title=title,
            )

    db.session.commit()
    return jsonify({"announcement": ann.to_dict()}), 201
