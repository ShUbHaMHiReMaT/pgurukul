"""Task management routes."""
from datetime import datetime
from flask import Blueprint, render_template, request, jsonify, abort, redirect, url_for, flash
from flask_login import login_required, current_user

from app import db
from backend.models.task import Task, TaskAssignment, TaskComment, TaskAttachment
from backend.models.user import User
from backend.models.department import Department
from backend.services.notification_service import notify_task_assigned, get_unread_count
from backend.services.activity_service import log_activity
from backend.utils.validators import sanitize_text

tasks_bp = Blueprint("tasks", __name__)


def _check_dept(dept_id: str) -> Department:
    dept = Department.query.get(dept_id)
    if not dept:
        abort(404)
    if not current_user.is_super_admin and current_user.department_id != dept_id:
        abort(403)
    return dept


@tasks_bp.route("/<dept_id>")
@login_required
def tasks_view(dept_id: str):
    dept = _check_dept(dept_id)
    status_filter = request.args.get("status", "all")
    priority_filter = request.args.get("priority", "all")

    q = Task.query.filter_by(department_id=dept_id, is_deleted=False)
    if status_filter != "all":
        q = q.filter_by(status=status_filter)
    if priority_filter != "all":
        q = q.filter_by(priority=priority_filter)

    tasks = q.order_by(Task.priority.desc(), Task.created_at.desc()).all()

    return render_template(
        "dashboard/tasks.html",
        dept=dept,
        tasks=tasks,
        status_filter=status_filter,
        priority_filter=priority_filter,
        members=dept.members,
        unread_count=get_unread_count(current_user.id),
    )


@tasks_bp.route("/<dept_id>/create", methods=["POST"])
@login_required
def create_task(dept_id: str):
    dept = _check_dept(dept_id)

    if not current_user.is_super_admin and not current_user.is_department_lead:
        return jsonify({"error": "Only department leads can create tasks."}), 403

    data = request.get_json(silent=True) or {}
    title = sanitize_text(data.get("title", ""), 255)
    description = sanitize_text(data.get("description", ""), 5000)
    priority = data.get("priority", "medium")
    due_date_str = data.get("due_date")
    assignee_ids = data.get("assignee_ids", [])

    if not title:
        return jsonify({"error": "Task title is required."}), 400

    if priority not in ("low", "medium", "high", "urgent"):
        priority = "medium"

    due_date = None
    if due_date_str:
        try:
            due_date = datetime.fromisoformat(due_date_str)
        except ValueError:
            pass

    task = Task(
        department_id=dept_id,
        created_by_id=current_user.id,
        title=title,
        description=description,
        priority=priority,
        due_date=due_date,
        status="not_started",
    )
    db.session.add(task)
    db.session.flush()

    # Assign users
    for uid in assignee_ids:
        user = User.query.filter_by(id=uid, department_id=dept_id).first()
        if user:
            assignment = TaskAssignment(task_id=task.id, user_id=uid)
            db.session.add(assignment)
            notify_task_assigned(
                assignee_id=uid,
                actor_id=current_user.id,
                actor_username=current_user.username,
                task_id=task.id,
                task_title=title,
                department_id=dept_id,
            )

    db.session.commit()
    log_activity(
        user_id=current_user.id,
        department_id=dept_id,
        action="task_created",
        resource_type="task",
        resource_id=task.id,
        details=title,
    )
    return jsonify({"task": task.to_dict()}), 201


@tasks_bp.route("/<dept_id>/<task_id>", methods=["GET"])
@login_required
def task_detail(dept_id: str, task_id: str):
    _check_dept(dept_id)
    task = Task.query.filter_by(id=task_id, department_id=dept_id, is_deleted=False).first_or_404()
    return jsonify({"task": task.to_dict()})


@tasks_bp.route("/<dept_id>/<task_id>/update", methods=["POST"])
@login_required
def update_task(dept_id: str, task_id: str):
    dept = _check_dept(dept_id)
    task = Task.query.filter_by(id=task_id, department_id=dept_id, is_deleted=False).first_or_404()

    data = request.get_json(silent=True) or {}

    # Interns can only update status
    if current_user.is_intern:
        new_status = data.get("status")
        if new_status and new_status in ("not_started", "in_progress", "review", "completed"):
            task.status = new_status
            if new_status == "completed":
                task.completed_at = datetime.utcnow()
            db.session.commit()
            log_activity(
                user_id=current_user.id,
                department_id=dept_id,
                action="task_updated",
                resource_type="task",
                resource_id=task_id,
                details=f"Status changed to {new_status}",
            )
            return jsonify({"task": task.to_dict()})
        return jsonify({"error": "Interns can only update task status."}), 403

    # Lead or admin can update everything
    if "title" in data:
        task.title = sanitize_text(data["title"], 255)
    if "description" in data:
        task.description = sanitize_text(data["description"], 5000)
    if "status" in data and data["status"] in ("not_started", "in_progress", "review", "completed"):
        task.status = data["status"]
        if data["status"] == "completed":
            task.completed_at = datetime.utcnow()
    if "priority" in data and data["priority"] in ("low", "medium", "high", "urgent"):
        task.priority = data["priority"]
    if "due_date" in data:
        try:
            task.due_date = datetime.fromisoformat(data["due_date"]) if data["due_date"] else None
        except ValueError:
            pass

    db.session.commit()
    log_activity(
        user_id=current_user.id,
        department_id=dept_id,
        action="task_updated",
        resource_type="task",
        resource_id=task_id,
    )
    return jsonify({"task": task.to_dict()})


@tasks_bp.route("/<dept_id>/<task_id>/delete", methods=["POST"])
@login_required
def delete_task(dept_id: str, task_id: str):
    _check_dept(dept_id)
    if not current_user.is_super_admin and not current_user.is_department_lead:
        return jsonify({"error": "Not authorized."}), 403

    task = Task.query.filter_by(id=task_id, department_id=dept_id).first_or_404()
    task.is_deleted = True
    db.session.commit()
    log_activity(
        user_id=current_user.id,
        department_id=dept_id,
        action="task_updated",
        resource_type="task",
        resource_id=task_id,
        details="Task deleted",
    )
    return jsonify({"ok": True})


@tasks_bp.route("/<dept_id>/<task_id>/comment", methods=["POST"])
@login_required
def add_comment(dept_id: str, task_id: str):
    _check_dept(dept_id)
    task = Task.query.filter_by(id=task_id, department_id=dept_id, is_deleted=False).first_or_404()

    data = request.get_json(silent=True) or {}
    content = sanitize_text(data.get("content", ""), 2000)
    if not content:
        return jsonify({"error": "Comment content required."}), 400

    comment = TaskComment(task_id=task_id, author_id=current_user.id, content=content)
    db.session.add(comment)
    db.session.commit()
    return jsonify({"comment": comment.to_dict()}), 201
