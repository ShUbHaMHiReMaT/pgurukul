"""Auth required decorators and permission helpers."""
from functools import wraps
from flask import abort, jsonify, request
from flask_login import current_user


def login_required_api(f):
    """Return JSON 401 instead of redirect for API endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"error": "Authentication required"}), 401
        if not current_user.is_active:
            return jsonify({"error": "Account disabled"}), 403
        return f(*args, **kwargs)
    return decorated


def roles_required(*roles):
    """Decorator to restrict route to specific roles."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not current_user.is_authenticated:
                abort(403)
            if current_user.role not in roles:
                abort(403)
            return f(*args, **kwargs)
        return decorated
    return decorator


def super_admin_required(f):
    """Only super_admin can access."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_super_admin:
            abort(403)
        return f(*args, **kwargs)
    return decorated


def department_lead_or_admin(f):
    """department_lead or super_admin."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            abort(403)
        if current_user.role not in ("super_admin", "department_lead"):
            abort(403)
        return f(*args, **kwargs)
    return decorated


def department_access_required(f):
    """Ensure the user can only access their own department.
    
    The view function must have `dept_id` or `department_id` in kwargs
    OR the request must contain it in the JSON/form body.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            abort(401)

        # Super admin bypasses all department checks
        if current_user.is_super_admin:
            return f(*args, **kwargs)

        # Get department_id from route params
        dept_id = (
            kwargs.get("dept_id")
            or kwargs.get("department_id")
        )

        # Fallback: check request JSON or form
        if not dept_id:
            if request.is_json:
                dept_id = request.get_json(silent=True, force=True).get("department_id")
            elif request.form:
                dept_id = request.form.get("department_id")

        if dept_id and current_user.department_id != dept_id:
            abort(403)

        return f(*args, **kwargs)
    return decorated
