# 💰 Hisaab Counter

A real-time group expense tracker backed by Firebase Realtime Database.

## Features

- 📊 Live sync via Firebase Realtime Database
- ➕ Add debit (they owe) or credit (they paid) entries per person
- 👤 Add new people on the fly
- 🔼 Sorted by highest balance (most owed at top)
- 📸 Save individual person view OR full overview as JPEG
  - Filename format: `saloni_01062026_1340.jpeg`
- 🗑 Delete individual entries
- 🔍 Search people by name
- 🌱 One-click seed with original March–June 2025 data

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Run locally

```bash
npm run dev
```

Open http://localhost:5173

### 3. Load initial data

In the app, click the **🌱 Seed** button (bottom-right of controls).  
This loads all the original hisaab data into Firebase. **Do this only once.**

---

## Deploy to Firebase Hosting

### Install Firebase CLI (if not already)

```bash
npm install -g firebase-tools
```

### Login

```bash
firebase login
```

### Build & Deploy

```bash
npm run build
firebase deploy
```

Your app will be live at: **https://hissab-counter.web.app**

---

## How to use

| Action | How |
|--------|-----|
| View someone's ledger | Tap their card |
| Add a transaction | Open person → **+ Add** |
| Record a payment | Add entry → select **"They paid"** (credit) |
| Take money from them | Add entry → select **"They owe"** (debit) |
| Save their statement as image | Open person → **📸 Save** |
| Save full overview as image | Main screen → **📸 Overview** |
| Add a new person | **+ Person** button |
| Delete an entry | 🗑 icon on any entry |

---

## Firebase Database Rules

```json
{
  "rules": {
    ".read": "now < 1782844200000",
    ".write": "now < 1782844200000"
  }
}
```

Rules allow read/write until **July 1, 2026**. Update as needed in Firebase Console.

---

## Project Structure

```
hisaab-counter/
├── src/
│   ├── App.jsx          # Main app + all components
│   ├── firebase.js      # Firebase init & db export
│   ├── seedData.js      # Initial data loader
│   └── main.jsx         # React entry point
├── index.html
├── vite.config.js
├── firebase.json        # Firebase Hosting config
├── .firebaserc          # Firebase project alias
├── .gitignore           # node_modules, dist, .env etc.
└── package.json
```
