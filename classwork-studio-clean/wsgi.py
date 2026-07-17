from app import app
import os

if __name__ == '__main__':
    # Ensure runtime directories exist before the first request.
    os.makedirs('static', exist_ok=True)
    os.makedirs('tasks', exist_ok=True)

    print("Starting Classwork Studio Server...")
    print("Open http://0.0.0.0:5000 in your browser")

    try:
        from waitress import serve
        print("Running with Waitress (production mode)...")
        serve(app, host='0.0.0.0', port=5000, threads=4)
    except ImportError:
        print("Waitress not installed, falling back to Flask dev server...")
        app.run(host='0.0.0.0', port=5000, debug=False)
