"""
PGURUKUL — Database Initializer + Seeder (CLI)

The app now runs this automatically on every boot (see backend/db_bootstrap.py
and app.py), so this script is optional — useful for checking connectivity
or re-seeding by hand, but nothing depends on it being run manually anymore.

Run: python setup_db.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from sqlalchemy import text, inspect
from backend.db_bootstrap import bootstrap_database

app = create_app()

with app.app_context():
    print("=" * 60)
    print("PGURUKUL — Database Setup")
    print("=" * 60)

    try:
        with db.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[OK] Database connection successful")
        print(f"     {app.config['SQLALCHEMY_DATABASE_URI'][:70]}")
    except Exception as e:
        print(f"[FAIL] Cannot connect to DB: {e}")
        sys.exit(1)

    bootstrap_database(app, db, log=lambda msg: print(f"[OK] {msg}"))

    table_names = sorted(inspect(db.engine).get_table_names())
    print(f"[OK] {len(table_names)} tables: {', '.join(table_names)}")

    print("=" * 60)
    print("Setup done! Run:  python wsgi.py")
    print("Visit:            http://localhost:5000")
    print("=" * 60)
