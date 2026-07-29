"""Dashboard routes — main app views."""
import os
from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, current_app
from flask_login import login_required, current_user

from app import db
from backend.models.user import User
from backend.models.department import Department
from backend.models.announcement import Announcement, Notification, ActivityLog
from backend.models.file import File
from backend.models.task import Task
from backend.services.activity_service import log_activity
from backend.services.notification_service import get_unread_count
from backend.utils.validators import sanitize_text

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.before_request
@login_required
def require_login():
    """All dashboard routes require authentication."""
    pass


@dashboard_bp.route("/")
def index():
    """Main dashboard — overview for current user's department."""
    dept = current_user.department
    
    # Stats for the sidebar/overview
    ctx = {
        "dept": dept,
        "unread_count": get_unread_count(current_user.id),
    }

    if dept:
        ctx["recent_files"] = (
            File.query
            .filter_by(department_id=dept.id, is_deleted=False)
            .order_by(File.created_at.desc())
            .limit(5)
            .all()
        )
        ctx["active_tasks"] = (
            Task.query
            .filter(Task.department_id == dept.id, Task.is_deleted == False, Task.status != "completed")
            .order_by(Task.created_at.desc())
            .limit(5)
            .all()
        )
        ctx["member_count"] = len(dept.members)
        ctx["announcements"] = (
            Announcement.query
            .filter(
                Announcement.is_deleted == False,
                db.or_(Announcement.department_id == dept.id, Announcement.is_global == True)
            )
            .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
            .limit(3)
            .all()
        )
    elif current_user.is_super_admin:
        # Admin sees platform-wide stats
        ctx["total_users"] = User.query.filter_by(is_active=True).count()
        ctx["total_depts"] = Department.query.filter_by(is_active=True).count()
        ctx["total_files"] = File.query.filter_by(is_deleted=False).count()
        ctx["total_tasks"] = Task.query.filter_by(is_deleted=False).count()
        ctx["recent_activity"] = (
            ActivityLog.query
            .order_by(ActivityLog.created_at.desc())
            .limit(10)
            .all()
        )

    # Update last seen
    from datetime import datetime
    current_user.last_seen_at = datetime.utcnow()
    db.session.commit()

    return render_template("dashboard/index.html", **ctx)


@dashboard_bp.route("/profile", methods=["GET", "POST"])
def profile():
    if request.method == "POST":
        display_name = sanitize_text(request.form.get("display_name", ""), 100)
        bio = sanitize_text(request.form.get("bio", ""), 500)
        
        # Avatar upload
        avatar_file = request.files.get("avatar")
        if avatar_file and avatar_file.filename:
            from backend.services.storage_service import storage_service
            try:
                key, url, _ = storage_service.upload_file(
                    avatar_file,
                    f"avatar_{current_user.id}",
                    current_user.department_id or "global",
                    avatar_file.content_type or "image/jpeg",
                )
                current_user.avatar_url = url
            except Exception as e:
                flash(f"Avatar upload failed: {e}", "error")

        current_user.display_name = display_name
        current_user.bio = bio
        db.session.commit()

        log_activity(
            user_id=current_user.id,
            action="profile_updated",
        )
        flash("Profile updated successfully.", "success")
        return redirect(url_for("dashboard.profile"))

    return render_template("dashboard/profile.html",
                           user=current_user,
                           unread_count=get_unread_count(current_user.id))


@dashboard_bp.route("/members")
def members():
    """View department members."""
    dept = current_user.department
    if not dept:
        if current_user.is_super_admin:
            flash("Super admins aren't tied to a department — use the Admin Panel to manage users.", "info")
            return redirect(url_for("admin.users"))
        flash("You are not part of a department.", "warning")
        return redirect(url_for("dashboard.index"))

    members = dept.members
    return render_template("dashboard/members.html",
                           dept=dept,
                           members=members,
                           unread_count=get_unread_count(current_user.id))


@dashboard_bp.route("/notifications")
def notifications():
    """Notification center."""
    notifs = (
        Notification.query
        .filter_by(user_id=current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return render_template("dashboard/notifications.html",
                           notifications=notifs,
                           unread_count=get_unread_count(current_user.id))


@dashboard_bp.route("/notifications/mark-read", methods=["POST"])
def mark_notifications_read():
    from backend.services.notification_service import mark_all_read
    count = mark_all_read(current_user.id)
    return jsonify({"marked": count})


@dashboard_bp.route("/notifications/count")
def notification_count():
    count = get_unread_count(current_user.id)
    return jsonify({"count": count})
