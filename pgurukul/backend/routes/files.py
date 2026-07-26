"""File management routes."""
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, send_file, abort
from flask_login import login_required, current_user

from app import db
from backend.models.file import File, FileVersion
from backend.models.department import Department
from backend.services.file_service import upload_file, delete_file, rename_file, restore_version
from backend.services.storage_service import storage_service
from backend.services.notification_service import get_unread_count
from backend.utils.validators import sanitize_text

files_bp = Blueprint("files", __name__)


def _check_dept(dept_id: str) -> Department:
    dept = Department.query.get(dept_id)
    if not dept:
        abort(404)
    if not current_user.is_super_admin and current_user.department_id != dept_id:
        abort(403)
    return dept


@files_bp.route("/<dept_id>")
@login_required
def files_view(dept_id: str):
    dept = _check_dept(dept_id)
    folder = request.args.get("folder", "/")
    search = request.args.get("q", "")

    q = File.query.filter_by(department_id=dept_id, is_deleted=False)

    if search:
        q = q.filter(File.name.ilike(f"%{search}%"))
    else:
        q = q.filter_by(folder_path=folder)

    files = q.order_by(File.created_at.desc()).all()

    # Build folder list from file paths
    all_paths = db.session.query(File.folder_path).filter_by(
        department_id=dept_id, is_deleted=False
    ).distinct().all()
    folders = sorted(set(p[0] for p in all_paths if p[0] != folder))

    return render_template(
        "dashboard/files.html",
        dept=dept,
        files=files,
        folders=folders,
        current_folder=folder,
        search_query=search,
        unread_count=get_unread_count(current_user.id),
    )


@files_bp.route("/<dept_id>/upload", methods=["POST"])
@login_required
def upload(dept_id: str):
    _check_dept(dept_id)

    if "file" not in request.files:
        return jsonify({"error": "No file in request."}), 400

    file = request.files["file"]
    folder = sanitize_text(request.form.get("folder", "/"), 500)
    description = sanitize_text(request.form.get("description", ""), 500)
    change_note = sanitize_text(request.form.get("change_note", ""), 200)

    f_record, error = upload_file(
        file=file,
        department_id=dept_id,
        uploader_id=current_user.id,
        folder_path=folder,
        description=description,
        change_note=change_note,
    )

    if error:
        return jsonify({"error": error}), 400

    return jsonify({"file": f_record.to_dict()}), 201


@files_bp.route("/<dept_id>/files/<file_id>/versions")
@login_required
def file_versions(dept_id: str, file_id: str):
    _check_dept(dept_id)
    f = File.query.filter_by(id=file_id, department_id=dept_id).first_or_404()
    versions = FileVersion.query.filter_by(file_id=file_id).order_by(FileVersion.version_number.desc()).all()
    return jsonify({
        "file": f.to_dict(),
        "versions": [v.to_dict() for v in versions],
    })


@files_bp.route("/<dept_id>/files/<file_id>/restore/<version_id>", methods=["POST"])
@login_required
def restore(dept_id: str, file_id: str, version_id: str):
    _check_dept(dept_id)
    f, err = restore_version(file_id, version_id, current_user.id, dept_id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"file": f.to_dict()})


@files_bp.route("/<dept_id>/files/<file_id>/delete", methods=["POST"])
@login_required
def delete(dept_id: str, file_id: str):
    dept = _check_dept(dept_id)

    # Only uploader, dept lead, or admin can delete
    f = File.query.filter_by(id=file_id, department_id=dept_id).first_or_404()
    if (f.uploader_id != current_user.id
            and not current_user.is_super_admin
            and not current_user.is_department_lead):
        return jsonify({"error": "Not authorized."}), 403

    err = delete_file(file_id, current_user.id, dept_id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True})


@files_bp.route("/<dept_id>/files/<file_id>/rename", methods=["POST"])
@login_required
def rename(dept_id: str, file_id: str):
    _check_dept(dept_id)
    data = request.get_json(silent=True) or {}
    new_name = sanitize_text(data.get("name", ""), 255)
    if not new_name:
        return jsonify({"error": "New name required."}), 400

    err = rename_file(file_id, new_name, current_user.id, dept_id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True})


@files_bp.route("/<dept_id>/files/<file_id>/favorite", methods=["POST"])
@login_required
def toggle_favorite(dept_id: str, file_id: str):
    _check_dept(dept_id)
    f = File.query.filter_by(id=file_id, department_id=dept_id, is_deleted=False).first_or_404()
    f.is_favorite = not f.is_favorite
    db.session.commit()
    return jsonify({"is_favorite": f.is_favorite})


@files_bp.route("/<dept_id>/files/<file_id>/download")
@login_required
def download(dept_id: str, file_id: str):
    _check_dept(dept_id)
    f = File.query.filter_by(id=file_id, department_id=dept_id, is_deleted=False).first_or_404()

    from backend.services.activity_service import log_activity
    log_activity(
        user_id=current_user.id,
        department_id=dept_id,
        action="file_downloaded",
        resource_type="file",
        resource_id=file_id,
        details=f.name,
    )

    if f.storage_url:
        from flask import redirect
        return redirect(f.storage_url)

    # Local fallback
    import os
    full_path = os.path.join(
        current_user._sa_instance_state.session_id,  # placeholder
    )
    abort(404)
