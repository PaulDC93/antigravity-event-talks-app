# BigQuery Release Hub & Sharing Console

A premium, real-time developer dashboard to monitor Google Cloud BigQuery Release Notes, filter/search updates, and share features directly to Twitter/X with dynamic character constraint validation.

Built using a **Python Flask** backend and a **vanilla HTML/JS/CSS** frontend.

---

## ✨ Features

- **Granular Decomposition**: Splits consolidated daily release entries into discrete updates (e.g. Features, Deprecations, Issues, and Announcements).
- **Dual-Mode Cache**: Uses a 1-hour local file cache (`cache.json`) to prevent API throttling and ensure sub-second page loads, with an on-demand refresh capability.
- **Client-Side Filter & Search**: Instant searching across dates, tags, and keywords. Real-time statistics pills showing total counts.
- **Mock Twitter/X Composer Sandbox**: Live preview of social posts with dynamic text formatting, character budget tracking, and automatic safety constraints.
- **Web Intent Integration**: Safely redirects finalized posts to official Twitter/X device links, bypassing the need for complex developer API key registration.
- **Responsive Elements Docking**: Smoothly moves the composer container between desktop sticky sidebar view and mobile overlay bottom-sheet modal.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                      CLIENT SIDE                       │
│  - HTML5 & CSS Variables (Glassmorphic timeline feed)  │
│  - Vanilla JavaScript state manager & layout docking   │
│  - Twitter/X Template parsing & character validator     │
└──────────────────────────┬─────────────────────────────┘
                           │ API Requests
                           ▼ (/api/releases, /api/refresh)
┌────────────────────────────────────────────────────────┐
│                      SERVER SIDE                       │
│  - Flask Web Server (App host & API router)            │
│  - Atom XML feed downloader & namespace parser         │
│  - Heading split parser & plaintext clean engine       │
│  - cache.json local buffer storage                     │
└──────────────────────────┬─────────────────────────────┘
                           │ Feed Fetch
                           ▼
┌────────────────────────────────────────────────────────┐
│               GOOGLE CLOUD RELEASE FEED                │
└────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
bq-releases-notes/
├── app.py              # Flask server, feed parsing, and cache manager
├── cache.json          # Local file-based caching buffer (auto-generated)
├── templates/
│   └── index.html      # Desktop and mobile HTML dashboard layout
├── static/
│   ├── css/
│   │   └── style.css   # Styling variables, timeline cards, and keyframe animations
│   └── js/
│       └── app.js      # Client state controller, filters, and Composer engine
├── .gitignore          # Excludes environments, system files, and local cache
└── README.md           # Project configuration and setup guide
```

---

## 🚀 Setup & Execution

### Prerequisites
Make sure you have Python (version 3.6+) installed on your system.

### 1. Clone & Navigate
Navigate to the project root directory:
```bash
cd C:\Users\pauld\agy-cli-projects\bq-releases-notes
```

### 2. Install Dependencies
Install Flask and requests dependencies via `pip`:
```bash
pip install Flask requests
```

### 3. Start the Web Server
Launch the Flask development server:
```bash
python app.py
```
*The terminal will output:*
`* Running on http://127.0.0.1:5000 (Press CTRL+C to quit)`

### 4. Open the Web App
Open your browser and navigate to:
**[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🐦 How to Share Updates
1. Click **"Tweet Update"** on any release note card.
2. The card will highlight with a glowing border and load in the **Tweet Composer**.
3. Choose a template (e.g. *🚀 Feature Drop*, *💼 Technical Summary*) or customize the text in the input area.
4. Verify the character limit counter is green/valid (under 280 characters).
5. Click **"Share to X / Twitter"** to open the web intent window and post.
