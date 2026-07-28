"""Admin control panel routes — super admin only."""
import json
from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, abort
from flask_login import login_required, current_user
from sqlalchemy import inspect, text, func

from app import db
from backend.models.user import User
from backend.models.department import Department
from backend.models.file import File, FileVersion
from backend.models.task import Task
from backend.models.announcement import Announcement, ActivityLog, Notification
from backend.models.message import Message
from backend.services.auth_service import hash_password, create_super_admin, admin_reset_password
from backend.services.storage_service import storage_service
from backend.services.activity_service import log_activity
from backend.middleware.auth_required import super_admin_required
from backend.utils.validators import sanitize_text, validate_email

admin_bp = Blueprint("admin", __name__)


def _admin_required():
    if not current_user.is_authenticated or not current_user.is_super_admin:
        abort(403)


@admin_bp.before_request
@login_required
def check_admin():
    _admin_required()


# ──────────────────────────────────────────────────────────────────────────────
# Dashboard Overview
# ──────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/")
def admin_index():
    stats = {
        "total_users": User.query.filter_by(is_active=True).count(),
        "total_departments": Department.query.filter_by(is_active=True).count(),
        "total_files": File.query.filter_by(is_deleted=False).count(),
        "total_tasks": Task.query.filter_by(is_deleted=False).count(),
        "total_messages": Message.query.filter_by(is_deleted=False).count(),
        "total_announcements": Announcement.query.filter_by(is_deleted=False).count(),
        "storage": storage_service.get_storage_stats(),
    }

    recent_logs = (
        ActivityLog.query
        .order_by(ActivityLog.created_at.desc())
        .limit(20)
        .all()
    )

    departments = Department.query.filter_by(is_active=True).all()

    return render_template(
        "admin/index.html",
        stats=stats,
        recent_logs=recent_logs,
        departments=departments,
    )


# ──────────────────────────────────────────────────────────────────────────────
# User Management
# ──────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/users")
def users():
    search = request.args.get("q", "")
    role_filter = request.args.get("role", "all")
    dept_filter = request.args.get("dept", "all")

    q = User.query
    if search:
        q = q.filter(
            db.or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.display_name.ilike(f"%{search}%"),
            )
        )
    if role_filter != "all":
        q = q.filter_by(role=role_filter)
    if dept_filter != "all":
        q = q.filter_by(department_id=dept_filter)

    users_list = q.order_by(User.created_at.desc()).all()
    departments = Department.query.filter_by(is_active=True).all()

    return render_template(
        "admin/users.html",
        users=users_list,
        departments=departments,
        search=search,
        role_filter=role_filter,
        dept_filter=dept_filter,
    )


@admin_bp.route("/users/create", methods=["POST"])
def create_user():
    data = request.get_json(silent=True) or request.form

    username = sanitize_text(data.get("username", ""), 50)
    email = sanitize_text(data.get("email", ""), 255).lower()
    password = data.get("password", "")
    role = data.get("role", "intern")
    dept_id = data.get("department_id") or None

    if role not in ("super_admin", "department_lead", "intern"):
        return jsonify({"error": "Invalid role."}), 400

    email_err = validate_email(email)
    if email_err:
        return jsonify({"error": email_err}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": f"Username '{username}' already taken."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already in use."}), 400

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password or "ChangeMe@123"),
        role=role,
        department_id=dept_id,
        is_active=True,
        is_verified=True,
    )
    db.session.add(user)
    db.session.commit()

    log_activity(
        user_id=current_user.id,
        action="user_created",
        resource_type="user",
        resource_id=user.id,
        details=f"Created user {username} with role {role}",
    )
    return jsonify({"user": user.to_dict(public=False)}), 201


@admin_bp.route("/users/<user_id>/update", methods=["POST"])
def update_user(user_id: str):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    if "display_name" in data:
        user.display_name = sanitize_text(data["display_name"], 100)
    if "role" in data and data["role"] in ("super_admin", "department_lead", "intern"):
        user.role = data["role"]
    if "department_id" in data:
        user.department_id = data["department_id"] or None
    if "is_active" in data:
        user.is_active = bool(data["is_active"])

    db.session.commit()
    log_activity(
        user_id=current_user.id,
        action="admin_action",
        resource_type="user",
        resource_id=user_id,
        details=f"Updated user {user.username}",
    )
    return jsonify({"user": user.to_dict(public=False)})


@admin_bp.route("/users/<user_id>/delete", methods=["POST"])
def delete_user(user_id: str):
    if user_id == current_user.id:
        return jsonify({"error": "Cannot delete your own account."}), 400

    user = User.query.get_or_404(user_id)
    username = user.username
    db.session.delete(user)
    db.session.commit()

    log_activity(
        user_id=current_user.id,
        action="user_deleted",
        resource_type="user",
        resource_id=user_id,
        details=f"Deleted user {username}",
    )
    return jsonify({"ok": True})


@admin_bp.route("/users/<user_id>/reset-password", methods=["POST"])
def reset_password(user_id: str):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}
    new_password = data.get("new_password", "")

    err = admin_reset_password(user, new_password, current_user)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True})


@admin_bp.route("/users/<user_id>/toggle-lock", methods=["POST"])
def toggle_lock(user_id: str):
    user = User.query.get_or_404(user_id)
    if user.is_locked:
        user.locked_until = None
        user.failed_login_attempts = 0
        msg = f"Unlocked account: {user.username}"
    else:
        user.locked_until = datetime.utcnow() + timedelta(days=365)
        msg = f"Locked account: {user.username}"
    db.session.commit()
    log_activity(user_id=current_user.id, action="admin_action", details=msg)
    return jsonify({"is_locked": user.is_locked})


# ──────────────────────────────────────────────────────────────────────────────
# Department Management
# ──────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/departments")
def departments():
    depts = Department.query.order_by(Department.created_at.desc()).all()
    return render_template("admin/departments.html", departments=depts)


@admin_bp.route("/departments/create", methods=["POST"])
def create_department():
    import secrets
    import re

    data = request.get_json(silent=True) or {}
    name = sanitize_text(data.get("name", ""), 100)
    description = sanitize_text(data.get("description", ""), 500)
    temp_password = data.get("temp_password", secrets.token_urlsafe(8))
    icon = data.get("icon", "🏢")

    if not name:
        return jsonify({"error": "Department name is required."}), 400

    if Department.query.filter_by(name=name).first():
        return jsonify({"error": f"Department '{name}' already exists."}), 400

    slug = re.sub(r"[^a-z0-9-]", "-", name.lower()).strip("-")
    if Department.query.filter_by(slug=slug).first():
        slug = f"{slug}-{secrets.token_hex(3)}"

    dept = Department(
        name=name,
        slug=slug,
        description=description,
        icon=icon,
        temp_password=hash_password(temp_password),
    )
    db.session.add(dept)
    db.session.commit()

    log_activity(
        user_id=current_user.id,
        action="admin_action",
        resource_type="department",
        resource_id=dept.id,
        details=f"Created department {name}",
    )
    return jsonify({
        "department": dept.to_dict(),
        "temp_password_plain": temp_password,
    }), 201


@admin_bp.route("/departments/<dept_id>/delete", methods=["POST"])
def delete_department(dept_id: str):
    dept = Department.query.get_or_404(dept_id)
    dept_name = dept.name
    dept.is_active = False  # Soft delete
    db.session.commit()
    log_activity(
        user_id=current_user.id,
        action="admin_action",
        resource_type="department",
        resource_id=dept_id,
        details=f"Disabled department {dept_name}",
    )
    return jsonify({"ok": True})


@admin_bp.route("/departments/<dept_id>/set-lead", methods=["POST"])
def set_lead(dept_id: str):
    dept = Department.query.get_or_404(dept_id)
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if user_id:
        user = User.query.filter_by(id=user_id, department_id=dept_id).first()
        if not user:
            return jsonify({"error": "User not found in department."}), 404
        user.role = "department_lead"
        dept.lead_id = user.id
    else:
        dept.lead_id = None

    db.session.commit()
    return jsonify({"ok": True})


# ──────────────────────────────────────────────────────────────────────────────
# Database Viewer (phpMyAdmin-like, read-only by default)
# ──────────────────────────────────────────────────────────────────────────────

ALLOWED_TABLES = [
    "users", "departments", "messages", "mentions",
    "files", "file_versions", "tasks", "task_assignments",
    "task_comments", "announcements", "announcement_reads",
    "notifications", "activity_logs", "message_read_receipts",
]


@admin_bp.route("/database")
def db_viewer():
    inspector = inspect(db.engine)
    tables = [t for t in inspector.get_table_names() if t in ALLOWED_TABLES]
    table_info = {}
    for t in tables:
        try:
            count = db.session.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            table_info[t] = {"count": count}
        except Exception:
            table_info[t] = {"count": "?"}
    return render_template("admin/db_viewer.html", tables=tables, table_info=table_info)


@admin_bp.route("/database/<table_name>")
def db_table(table_name: str):
    if table_name not in ALLOWED_TABLES:
        abort(403)

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, int(request.args.get("per_page", 25)))
    search = request.args.get("q", "")
    sort_col = request.args.get("sort", "")
    sort_dir = request.args.get("dir", "desc")

    inspector = inspect(db.engine)
    columns = [c["name"] for c in inspector.get_columns(table_name)]

    offset = (page - 1) * per_page
    sort_clause = ""
    if sort_col and sort_col in columns:
        direction = "DESC" if sort_dir == "desc" else "ASC"
        sort_clause = f"ORDER BY {sort_col} {direction}"

    where_clause = ""
    params = {}
    if search and "created_at" in columns:
        # Basic search
        where_clause = ""  # Would need dynamic building — skip for safety

    try:
        total = db.session.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
        rows_result = db.session.execute(
            text(f"SELECT * FROM {table_name} {sort_clause} LIMIT :limit OFFSET :offset"),
            {"limit": per_page, "offset": offset}
        )
        rows = [dict(row._mapping) for row in rows_result]
    except Exception as e:
        rows = []
        total = 0
        columns = []

    total_pages = max(1, (total + per_page - 1) // per_page)

    return render_template(
        "admin/db_table.html",
        table_name=table_name,
        columns=columns,
        rows=rows,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        search=search,
        tables=ALLOWED_TABLES,
        sort_col=sort_col,
        sort_dir=sort_dir,
    )


@admin_bp.route("/database/<table_name>/export")
def export_table(table_name: str):
    if table_name not in ALLOWED_TABLES:
        abort(403)

    fmt = request.args.get("format", "csv")
    result = db.session.execute(text(f"SELECT * FROM {table_name} LIMIT 5000"))
    rows = [dict(row._mapping) for row in result]

    if fmt == "json":
        from flask import Response
        return Response(
            json.dumps(rows, default=str, indent=2),
            mimetype="application/json",
            headers={"Content-Disposition": f"attachment; filename={table_name}.json"},
        )
    else:
        import csv
        import io
        from flask import Response
        output = io.StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={table_name}.csv"},
        )


# ──────────────────────────────────────────────────────────────────────────────
# Storage Viewer
# ──────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/storage")
def storage_viewer():
    stats = storage_service.get_storage_stats()

    # Per-department storage
    dept_storage = (
        db.session.query(
            Department.name,
            Department.id,
            func.sum(File.size_bytes).label("total_bytes"),
            func.count(File.id).label("file_count"),
        )
        .join(File, File.department_id == Department.id, isouter=True)
        .filter(db.or_(File.is_deleted == False, File.id == None))
        .group_by(Department.id, Department.name)
        .all()
    )

    # Largest files
    largest = (
        File.query
        .filter_by(is_deleted=False)
        .order_by(File.size_bytes.desc())
        .limit(20)
        .all()
    )

    # Recent uploads
    recent = (
        File.query
        .filter_by(is_deleted=False)
        .order_by(File.created_at.desc())
        .limit(20)
        .all()
    )

    return render_template(
        "admin/storage_viewer.html",
        stats=stats,
        dept_storage=dept_storage,
        largest=largest,
        recent=recent,
    )


# ──────────────────────────────────────────────────────────────────────────────
# System Logs
# ──────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/logs")
def logs():
    action_filter = request.args.get("action", "all")
    dept_filter = request.args.get("dept", "all")
    user_filter = request.args.get("user", "")
    page = max(1, int(request.args.get("page", 1)))
    per_page = 50

    q = ActivityLog.query
    if action_filter != "all":
        q = q.filter_by(action=action_filter)
    if dept_filter != "all":
        q = q.filter_by(department_id=dept_filter)
    if user_filter:
        user = User.query.filter_by(username=user_filter).first()
        if user:
            q = q.filter_by(user_id=user.id)

    total = q.count()
    logs_list = (
        q.order_by(ActivityLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    departments = Department.query.filter_by(is_active=True).all()
    actions = ActivityLog.ACTIONS

    return render_template(
        "admin/logs.html",
        logs=logs_list,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, (total + per_page - 1) // per_page),
        action_filter=action_filter,
        dept_filter=dept_filter,
        user_filter=user_filter,
        departments=departments,
        actions=actions,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Global Announcements (admin shortcut)
# ──────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/announcements")
def admin_announcements():
    announcements = (
        Announcement.query
        .filter_by(is_deleted=False)
        .order_by(Announcement.created_at.desc())
        .all()
    )
    departments = Department.query.filter_by(is_active=True).all()
    return render_template("admin/announcements.html",
                           announcements=announcements,
                           departments=departments)


@admin_bp.route("/announcements/create", methods=["POST"])
def create_admin_announcement():
    from flask_login import current_user
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()
    department_id = data.get("department_id")
    is_pinned = bool(data.get("is_pinned"))
    is_global = bool(data.get("is_global", not department_id))

    if not title or not content:
        return jsonify({"error": "Title and content required"}), 400

    ann = Announcement(
        title=title,
        content=content,
        department_id=department_id,
        author_id=current_user.id,
        is_pinned=is_pinned,
        is_global=is_global,
    )
    db.session.add(ann)
    db.session.commit()
    return jsonify({"announcement": {"id": ann.id, "title": ann.title}})


@admin_bp.route("/announcements/<ann_id>/delete", methods=["POST"])
def delete_admin_announcement(ann_id: str):
    ann = Announcement.query.get_or_404(ann_id)
    ann.is_deleted = True
    db.session.commit()
    return jsonify({"ok": True})


@admin_bp.route("/departments/<dept_id>/update", methods=["POST"])
def update_department(dept_id: str):
    dept = Department.query.get_or_404(dept_id)
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400
    dept.name = name
    dept.icon = data.get("icon", dept.icon)
    storage_gb = data.get("storage_limit_gb")
    if storage_gb:
        dept.storage_limit_gb = int(storage_gb)
    db.session.commit()
    return jsonify({"department": {"id": dept.id, "name": dept.name}})


@admin_bp.route("/departments/<dept_id>/toggle", methods=["POST"])
def toggle_department(dept_id: str):
    dept = Department.query.get_or_404(dept_id)
    dept.is_active = not dept.is_active
    db.session.commit()
    return jsonify({"is_active": dept.is_active})

