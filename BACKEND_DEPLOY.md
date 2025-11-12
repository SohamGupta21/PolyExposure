# 🚂 Backend 1-Click Deploy

I've created all the config files. Now you just need to click a few buttons.

## Railway (Recommended - 2 minutes)

### Step 1: Push the config files

```bash
cd /Users/sohamgupta/Desktop/PolyExposure
git add .
git commit -m "Add Railway config"
git push
```

### Step 2: Deploy on Railway

1. Go to **[railway.app](https://railway.app)**
2. Click **"Login"** → Sign in with GitHub
3. Click **"New Project"**
4. Click **"Deploy from GitHub repo"**
5. Select **PolyExposure**
6. Railway will auto-detect the config and deploy! ✨

### Step 3: Get your URL

1. Click on your deployed service
2. Go to **"Settings"** tab
3. Scroll down to **"Networking"**
4. Click **"Generate Domain"**
5. Copy the URL (looks like: `https://polyexposure-production.up.railway.app`)

### Step 4: Add to Vercel

1. Go to **[vercel.com](https://vercel.com)** → Your project
2. **Settings** → **Environment Variables**
3. Click **"Add New"**
   - **Name**: `BACKEND_URL`
   - **Value**: `<paste-your-railway-url>`
4. Click **"Save"**
5. Go to **"Deployments"** tab → Click **"Redeploy"** on latest

---

## Alternative: Render (Also 2 minutes)

### Step 1: Push files (if not done)

```bash
cd /Users/sohamgupta/Desktop/PolyExposure
git add .
git commit -m "Add Render config"
git push
```

### Step 2: Deploy on Render

1. Go to **[render.com](https://render.com)**
2. Click **"Get Started"** → Sign up with GitHub
3. Click **"New +"** → **"Blueprint"**
4. Connect your **PolyExposure** repository
5. Render will detect `render.yaml` and auto-configure!
6. Click **"Apply"**

### Step 3: Get URL & Add to Vercel

Same as Railway steps 3-4 above.

---

## ✅ Done!

Your backend is deployed! Now your app will have full functionality:
- ✅ PNL calculations
- ✅ Position tracking  
- ✅ Sector exposure
- ✅ All backend features

---

## 🔒 Optional: Update CORS

After deployment, you can tighten security by setting the `ALLOWED_ORIGINS` environment variable in Railway/Render:

**Name**: `ALLOWED_ORIGINS`
**Value**: `https://your-vercel-app.vercel.app`

This restricts your backend to only accept requests from your frontend.

