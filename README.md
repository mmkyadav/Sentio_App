# Sentio — Emotionally Aware & AI-Moderated Social Sandbox

Sentio is a complete, premium social media platform (similar to X/Twitter or Reddit) centered on emotional expression, quiet aesthetic spaces, and advanced AI-powered safety features. 

The platform is designed to demonstrate robust protection against **prompt injections, jailbreaks, toxic inputs, and adversarial file uploads** using a combination of fast local pre-filter regex patterns and **Gemini 2.5 Flash** content moderation.

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
│   ├── database.py       # SQLite schema (users, posts, DMs, follows, communities)
│   ├── extractor.py      # PDF/Docx text parsers
│   ├── moderator.py      # Multi-tier content safety engine
│   └── main.py           # FastAPI REST API endpoints
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios backend configuration
│   │   ├── store/        # Zustand session storage
│   │   ├── components/   # Reusable UI (Sidebar, PostComposer, PostCard, DarkModeToggle)
│   │   └── pages/        # Auth, Home, Explore, Bookmarks, Profile, Messages, Communities
│   ├── postcss.config.js # Tailwind CSS configuration
│   └── package.json
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
```
*Note: If no key is supplied, the backend defaults to offline keyword filters automatically.*

### 3. Run the platform
Launch both servers concurrently using the provided orchestration script:
```bash
python run.py
```
* This boots the **FastAPI Backend** on [http://127.0.0.1:8000](http://127.0.0.1:8000)
* This launches the **Vite React Frontend** on [http://localhost:5173](http://localhost:5173)

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
