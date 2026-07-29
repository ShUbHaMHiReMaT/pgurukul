"""PGURUKUL WSGI entry point."""
from app import create_app

application = create_app()
app = application  # <--- Added this line!

if __name__ == "__main__":
    application.run(host="0.0.0.0", port=5000)