"""Search routes."""
from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user

from backend.services.search_service import global_search
from backend.services.notification_service import get_unread_count

search_bp = Blueprint("search", __name__)


@search_bp.route("/")
@login_required
def search_view():
    q = request.args.get("q", "").strip()
    results = {}

    if q and len(q) >= 2:
        results = global_search(
            query=q,
            department_id=current_user.department_id,
            user_role=current_user.role,
        )

    return render_template(
        "dashboard/search.html",
        query=q,
        results=results,
        unread_count=get_unread_count(current_user.id),
    )


@search_bp.route("/api")
@login_required
def search_api():
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return jsonify({"results": {}, "query": q})

    results = global_search(
        query=q,
        department_id=current_user.department_id,
        user_role=current_user.role,
    )
    return jsonify({"results": results, "query": q})
