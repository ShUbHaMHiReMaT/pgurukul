"""
PGURUKUL — Database Initializer + Seeder
Run: python setup_db.py
"""
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("=" * 60)
    print("PGURUKUL — Database Setup")
    print("=" * 60)

    # 1. Test connection
    try:
        with db.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[OK] Database connection successful")
        print(f"     {app.config['SQLALCHEMY_DATABASE_URI'][:70]}")
    except Exception as e:
        print(f"[FAIL] Cannot connect to DB: {e}")
        sys.exit(1)

    # 2. Import ALL models (order matters for FK resolution)
    from backend.models.department import Department
    from backend.models.user import User
    from backend.models.file import File, FileVersion
    from backend.models.message import Message, Mention
    from backend.models.task import Task, TaskAssignment
    from backend.models.announcement import Announcement, Notification, ActivityLog

    # 3. Create tables
    db.create_all()
    print("[OK] All tables created / verified")

    with db.engine.connect() as conn:
        rows = conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
        ).fetchall()
        print(f"[OK] {len(rows)} tables: {', '.join(r[0] for r in rows)}")

    # 4. Seed super admin
    existing_admin = User.query.filter_by(role='super_admin').first()
    if existing_admin:
        print(f"[OK] Super admin exists: {existing_admin.email}")
    else:
        from backend.services.auth_service import create_super_admin
        admin = create_super_admin(
            username='admin',
            email='admin@pgurukul.local',
            password='Admin@12345'
        )
        print("[OK] Super admin created:")
        print("     Email:    admin@pgurukul.local")
        print("     Password: Admin@12345")
        print("     *** CHANGE PASSWORD AFTER FIRST LOGIN ***")

    # 5. Seed demo department
    dept = Department.query.first()
    if dept:
        print(f"[OK] Department exists: {dept.name} (invite: {dept.invite_code})")
    else:
        import secrets
        demo = Department(
            name='General',
            slug='general',
            description='Default department for all team members',
            icon='🏢',
            storage_limit_bytes=50 * 1024 * 1024 * 1024,  # 50 GB
            is_active=True,
        )
        db.session.add(demo)
        db.session.commit()
        dept = demo
        print(f"[OK] Demo dept created: {demo.name}")
        print(f"     Invite code: {demo.invite_code}")

    # 5b. Seed named admin + intern accounts (idempotent — safe to re-run)
    from backend.services.auth_service import hash_password

    NAMED_ADMINS = [
        ("shubham", "shubham@pgurukul.local", "iWMzv1AxEau$"),
        ("shreyas", "shreyas@pgurukul.local", "0G5TSP45L8S&"),
        ("suyog", "suyog@pgurukul.local", "Pr4fk1bfyWE$"),
    ]
    NAMED_INTERNS = [
        ("vaish", "vaish@pgurukul.local", "JLAR7NhC3YN*"),
        ("shreecharan", "shreecharan@pgurukul.local", "o1EAGQqWCRe*"),
        ("adarsh", "adarsh@pgurukul.local", "KKwnoOc2ino@"),
        ("vinuta", "vinuta@pgurukul.local", "5IFmEvk9pYr#"),
        ("vinaya", "vinaya@pgurukul.local", "UExAr1CNpRQ*"),
    ]

    for username, email, password in NAMED_ADMINS:
        if User.query.filter((User.username == username) | (User.email == email)).first():
            continue
        db.session.add(User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="super_admin",
            is_active=True,
            is_verified=True,
        ))
    for username, email, password in NAMED_INTERNS:
        if User.query.filter((User.username == username) | (User.email == email)).first():
            continue
        db.session.add(User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="intern",
            department_id=dept.id,
            is_active=True,
            is_verified=True,
        ))
    db.session.commit()
    print(f"[OK] Seeded {len(NAMED_ADMINS)} named admins + {len(NAMED_INTERNS)} named interns (skipped any that already existed)")

    # 6. Upload folder
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    print(f"[OK] Upload folder: {app.config['UPLOAD_FOLDER']}")

    print("=" * 60)
    print("Setup done! Run:  python wsgi.py")
    print("Visit:            http://localhost:5000")
    print("=" * 60)
