import subprocess
import sys
import time
import os

def main():
    # Ensure current working directory is the script directory
    root_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root_dir)
    
    python_exe = sys.executable
    
    print("==================================================================")
    print("Starting Secure Social Sandbox...")
    print(f"Using Python: {python_exe}")
    print("==================================================================")
    
    # 1. Start FastAPI backend
    print("-> Launching FastAPI Backend (http://127.0.0.1:8000)...")
    backend_cmd = [python_exe, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"]
    backend_proc = subprocess.Popen(backend_cmd, cwd=root_dir)
    
    # Wait for backend to start up
    time.sleep(2)
    
    # 2. Start Vite React frontend
    print("-> Launching Vite React Frontend (http://localhost:5173)...")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=os.path.join(root_dir, "frontend"))
    
    print("\nSentio Social Platform is live!")
    print("   - API Endpoints: http://127.0.0.1:8000/docs")
    print("   - Social Platform UI: http://localhost:5173")
    print("Press Ctrl+C to terminate both servers cleanly.\n")
    
    try:
        while True:
            # Check if either process terminated
            backend_exit = backend_proc.poll()
            frontend_exit = frontend_proc.poll()
            
            if backend_exit is not None:
                print(f"\n[FAIL] Backend process exited with code {backend_exit}")
                break
            if frontend_exit is not None:
                print(f"\n[FAIL] Frontend process exited with code {frontend_exit}")
                break
                
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Interrupt received. Shutting down servers...")
    finally:
        # Clean up processes
        if backend_proc.poll() is None:
            backend_proc.terminate()
            backend_proc.wait()
            print("FastAPI Backend terminated.")
        if frontend_proc.poll() is None:
            frontend_proc.terminate()
            frontend_proc.wait()
            print("Vite React Frontend terminated.")
            
if __name__ == "__main__":
    main()
