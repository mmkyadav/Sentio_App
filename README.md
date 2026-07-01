# Sentio — Emotionally Aware & AI-Moderated Social Sandbox

Sentio is a complete, premium social media platform centered on emotional expression, quiet aesthetic spaces, and advanced AI-powered safety features. 

---

## 🎯 Main Objective

The core learning objective of **Sentio** is to explore and implement **production-grade content moderation using Large Language Models (LLMs) via APIs integrated into modern web frameworks**. The sandbox demonstrates:
1. How to leverage generative AI APIs to execute real-time content analysis, structured output classification, and multimodal security checks.
2. How to build hybrid safety guardrails in web frameworks that combine local performance-first heuristics with deep LLM-based reasoning.
3. How to design a distraction-free, emotionally-aware social platform featuring a premium, mindful user interface.

---

## 💡 The Developer's Approach

This project showcases a modern AI-assisted development workflow ("Vibecoding") combined with robust custom backend architecture:

### 🎨 Frontend: Lovable.ai & "Vibecoding"
* **Design & Prototyping**: The frontend design and layout referenced and drew inspiration from [Lovable.ai](https://lovable.dev/), utilizing its elegant UI components, clean cream/charcoal color themes, and premium social layouts.
* **Implementation ("Vibecoding")**: Based on the user interface and frontend components created, the client was developed using a rapid "vibecoding" approach—iterating dynamically with AI assistance to assemble components, write responsive styling using Tailwind CSS, and hook up Zustand state stores and React Router navigations.

### ⚙️ Backend: Custom Safety Engine & API Integrations
The backend was built from scratch to support the core objective of learning and implementing secure moderation pipelines:
* **API Framework**: Built using **FastAPI** to enable high-concurrency asynchronous endpoints for social posts, comments, direct messaging, and community operations.
* **LLM Integration**: Leveraged the **Google GenAI SDK** to query `gemini-2.5-flash` in real-time. Structured output schemas (`response_schema`) ensure that Gemini returns deterministic JSON responses classifying content severity and categories.
* **Multi-stage Moderation**:
  1. **Pre-filter**: Fast regex-based local checks to intercept simple injection payloads instantly.
  2. **Multimodal OCR**: Direct image analysis using Gemini 2.5 Flash to extract text written inside images.
  3. **Document Parsing**: Extracting text from uploaded PDF/Word attachments before running checks.
  4. **API Fail-safe Fallback**: In the event of API quota issues, the backend seamlessly falls back to local offline keyword filters.
* **Database & Storage**: Crafted custom SQL adapters (`SafeCursor`) to dynamically support SQLite, Turso (libSQL), and PostgreSQL (Supabase). For storage, supports Supabase and Cloudflare R2 with local fallbacks.

---

## 🔗 Live Link & Repository

* **Live Platform Website**: [https://sentiomedia.netlify.app/](https://sentiomedia.netlify.app/)
* **Source Code Repository**: [GitHub - mmkyadav/Sentio_App](https://github.com/mmkyadav/Sentio_App)

---

## 🛠️ Frameworks & Technologies Used

### Frontend (Modern SPA)
* **Core Library**: [React 19](https://react.dev/) (with [TypeScript](https://www.typescriptlang.org/))
* **Build Tool & Dev Server**: [Vite 6](https://vite.dev/)
* **State Management**: [Zustand 5](https://github.com/pmndrs/zustand) (for client session and active state handling)
* **Data Fetching / Server State**: [TanStack React Query 5](https://tanstack.com/query/latest)
* **HTTP Client**: [Axios](https://axios-http.com/)
* **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) & [PostCSS](https://postcss.org/)
* **Routing**: [React Router DOM 7](https://reactrouter.com/)
* **Animations**: [Framer Motion 12](https://www.framer.com/motion/)
* **Form Management & Validation**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
* **UI Components**: [Radix UI Primitives](https://www.radix-ui.com/) (Dialog, Tabs, Slot) & [Lucide React](https://lucide.dev/) (Icons)
* **Toasts/Alerts**: [Sonner](https://sonner.emilkowal.ski/)

### Backend (Robust REST API)
* **Core Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
* **ASGI Server**: [Uvicorn](https://www.uvicorn.org/)
* **AI Content Moderation**: [Google GenAI SDK](https://github.com/googleapis/google-genai) (using `gemini-2.5-flash`)
* **Document Processing & Parsing**:
  * [PyPDF 4](https://pypdf.readthedocs.io/) (for parsing `.pdf` attachments)
  * [python-docx](https://python-docx.readthedocs.io/) (for parsing `.docx` & `.doc` attachments)
* **Image Processing**: [Pillow (PIL) 10](https://pillow.readthedocs.io/) (for OCR visual parsing input)
* **Object Storage Support**: Connects to Cloudflare R2 (`boto3`) and Supabase Storage (`supabase-py`), with automated local disk fallback.
* **Testing Suite**: Integration-tested via custom validation scripts (`verify_backend_api.py` and `verify_moderation.py`).

### Flexible Multi-Database Layer
Sentio contains a custom SQL translation layer (`SafeCursor` in [database.py](file:///e:/Projects/Socio/backend/database.py)) that allows it to automatically configure and adapt to three different database engines based on availability:
1. **PostgreSQL**: Integrated via a Threaded Connection Pool to **Supabase PostgreSQL** (using `psycopg2`).
2. **Turso / libSQL**: Cloud-replicated Edge database support (using `libsql`).
3. **SQLite**: Standard local fallback (`secure_social.db`) for lightweight development with zero configurations.

---

## 🎨 Premium Paperback Aesthetic & Styling
Sentio features a custom Lovable-inspired UI:
* **Palette**: Warm cream background (`#FAF8F5`) for light mode, deep charcoal slate (`#121417`) for dark mode, and a soft warm accent (`#E05A47`).
* **Typography**: Serif branding headers ("Playfair Display") combined with clean, readable sans-serif body typography ("Outfit").
* **Layout**: A responsive three-column grid containing a sticky left navigation sidebar, a central feed with tabs, and a right trends and recommendations panel.

---

## ⚙️ Core Features

* **🔐 Authentication**: Registration and Login views with secure client state handling via Zustand.
* **📢 Social Feed**: Home view featuring toggles between "Following" and "Latest" posts, incorporating inline warnings for safety blocks.
* **🖼️ Media & File Uploads**: Support for attaching images and text documents (PDFs, Word Documents, TXT) to posts.
* **💬 Comments**: Inline reply threads under posts with separate moderation checking.
* **👤 User Profiles**: Cover banners, overlapping avatars, location/website metadata, post counts, and filtered feeds (Posts, Replies, Media, Files).
* **✉️ Direct Messages**: Real-time polling-based chat panel lists and conversations.
* **👥 Communities**: Sub-feeds where users can create, join, and browse topic-specific communities.
* **🔔 Notifications**: Real-time alerts for likes, replies, follows, and mentions.
* **🛡️ Dark Mode Switch**: Clean dark mode toggle on the top right next to the moderation indicator.

---

## 🛡️ Guardrails & Moderation Engine

Every post, comment, and message is moderated before database commit:
1. **Local Heuristics (Pre-filter)**: Instant scan for known prompt injection keywords or bypass attempts.
2. **Gemini 2.5 Flash API**: Real-time structured classification checking for prompt injections, targeted hate speech, adult content, violence, and illegal activity.
3. **Multimodal OCR**: Performs visual text extraction on attached images to detect text-based bypass attempts inside pictures.
4. **API Fail-safe Fallback**: In the event of a Gemini API quota exhaust or connection drop, the system automatically falls back to local offline keyword checks to guarantee uptime.
5. **Clean Error Sanitization**: Frontend boundaries intercept technical system errors (e.g. database locks or API errors) and output friendly, polished alert toasts.

---

## 📁 Repository Structure

```
Socio/
├── backend/
│   ├── database.py       # SQLite/libSQL/Postgres schema (users, posts, DMs, follows, communities)
│   ├── extractor.py      # PDF/Docx text parsers
│   ├── moderator.py      # Multi-tier content safety engine
│   └── main.py           # FastAPI REST API endpoints
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios backend configuration
│   │   ├── store/        # Zustand session storage
│   │   ├── components/   # Reusable UI (Sidebar, PostComposer, PostCard, DarkModeToggle)
│   │   └── pages/        # Auth, Home, Explore, Bookmarks, Profile, Messages, Communities
│   ├── postcss.config.js # PostCSS configuration
│   ├── tailwind.config.js# Tailwind CSS styling settings
│   ├── package.json
│   ├── vercel.json       # Routing config for Vercel deployment
│   └── netlify.toml      # Routing config for Netlify deployment
├── Dockerfile            # Container deployment configuration
├── run.py                # Concurrent local server runner
├── verify_backend_api.py # 17 backend REST integration tests
└── verify_moderation.py  # 6 safety moderation validator tests
```

---

## 🚀 Local Installation & Run Guide

### 1. Prerequisites
Ensure you have **Python 3.10+** and **Node.js v18+** installed.

### 2. Configure Environment Variables
Create a `.env` file in the root folder:
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=your_supabase_postgresql_url_here  (Optional fallback to local SQLite)
TURSO_DATABASE_URL=your_turso_db_url_here        (Optional fallback to local SQLite)
```
*Note: If no key is supplied, the backend defaults to offline keyword filters automatically.*

### 3. Run the platform
Launch both servers concurrently using the provided orchestration script:
```bash
python run.py
```
* This boots the **FastAPI Backend** (runs on port 8000)
* This launches the **Vite React Frontend** (runs on port 5173)

---

## 📦 Containerization & Deployment

You can build and package the backend API server into a Docker image:
```bash
# Build the docker container
docker build -t sentio-backend .

# Run the docker container
docker run -p 8000:8000 --env-file .env sentio-backend
```

---

## 🧪 Verification & Testing

Verify that all backend APIs and safety guardrails are working by running the test suites:

* **Backend API Integration Tests** (17/17 checks):
  ```bash
  python verify_backend_api.py
  ```
* **Content Moderation & Safety Checks** (6/6 checks):
  ```bash
  python verify_moderation.py
  ```
