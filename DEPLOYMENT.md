# 🚀 Deployment Guide - PolyPortfolio

This guide will walk you through deploying your PolyPortfolio app to Vercel.

## 📋 Prerequisites

1. A [GitHub](https://github.com) account
2. A [Vercel](https://vercel.com) account (sign up with GitHub)
3. Git installed on your machine

---

## 🎯 Deployment Steps

### Step 1: Push to GitHub

If you haven't already pushed your code to GitHub:

```bash
# Navigate to your project root
cd /Users/sohamgupta/Desktop/PolyExposure

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Ready for Vercel deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git branch -M main
git push -u origin main
```

### Step 2: Import Project to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### Step 3: Configure Project Settings

#### Root Directory
- Set **Root Directory** to: `frontend`

#### Framework Preset
- Should auto-detect as **Next.js**

#### Build Settings
- **Build Command**: `pnpm build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `pnpm install` (auto-detected)

### Step 4: Set Environment Variables

In the Vercel project settings, add this environment variable:

| Name | Value |
|------|-------|
| `BACKEND_URL` | `https://YOUR-APP-NAME.vercel.app` |

**Note**: You'll need to update this after your first deployment with the actual Vercel URL.

### Step 5: Deploy!

1. Click **"Deploy"**
2. Wait for the build to complete (usually 1-3 minutes)
3. Your app will be live at `https://YOUR-APP-NAME.vercel.app`

### Step 6: Update Backend URL

After first deployment:

1. Copy your Vercel deployment URL (e.g., `https://polyportfolio.vercel.app`)
2. Go to **Project Settings** → **Environment Variables**
3. Update `BACKEND_URL` to your actual URL
4. Redeploy (Vercel will auto-redeploy on the next git push)

---

## 🐍 Backend Deployment Options

Your backend (FastAPI) needs to be hosted separately. Here are three free options:

### Option A: Vercel Serverless Functions (Included in Setup)

✅ **Already configured!** The backend will deploy as serverless functions.

**How it works:**
- The `/api` folder in the root contains a serverless adapter
- Vercel automatically deploys Python functions
- All backend endpoints accessible at `https://your-app.vercel.app/api/*`

**Limitations:**
- 10-second timeout on Hobby plan
- Cold starts may cause slight delays

### Option B: Railway (Recommended for Heavy Usage)

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repository
5. Configure:
   - **Root Directory**: `backend`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Copy the Railway URL and update `BACKEND_URL` in Vercel

### Option C: Render

1. Go to [render.com](https://render.com)
2. Create new **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Copy the Render URL and update `BACKEND_URL` in Vercel

---

## 🔧 Post-Deployment Configuration

### Update CORS in Backend

After deployment, update the CORS settings in `backend/main.py`:

```python
allowed_origins = [
    "http://localhost:3000",
    "https://your-actual-vercel-url.vercel.app",  # Add your real URL
]
```

Or set the `ALLOWED_ORIGINS` environment variable in your backend hosting platform:

```
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://custom-domain.com
```

---

## 🔄 Continuous Deployment

Once set up, deployment is automatic:

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
3. Vercel automatically builds and deploys

---

## 🎨 Custom Domain (Optional)

### Add a Custom Domain:

1. Go to **Project Settings** → **Domains**
2. Click **"Add"**
3. Enter your domain (e.g., `polyportfolio.com`)
4. Follow DNS configuration instructions
5. Update CORS settings to include your custom domain

---

## 📊 Monitoring

### View Logs:
- Go to your Vercel project
- Click on a deployment
- View **"Build Logs"** and **"Function Logs"**

### Analytics:
- Vercel provides built-in analytics
- View traffic, performance, and errors in the dashboard

---

## 🐛 Troubleshooting

### "Failed to fetch" errors:
- Check that `BACKEND_URL` environment variable is set correctly
- Verify CORS settings in `backend/main.py`
- Check backend logs for errors

### Build failures:
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json` (frontend) and `requirements.txt` (backend)
- Verify Node.js version compatibility

### API timeouts:
- Vercel Hobby plan has 10s timeout for serverless functions
- Consider using Railway or Render for the backend if you need longer execution times

---

## 📝 Environment Variables Reference

### Frontend (Vercel)
| Variable | Description | Example |
|----------|-------------|---------|
| `BACKEND_URL` | URL of your backend API | `https://your-app.vercel.app` |

### Backend (Optional)
| Variable | Description | Example |
|----------|-------------|---------|
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | `https://app.vercel.app,https://custom.com` |

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Project imported to Vercel
- [ ] Root directory set to `frontend`
- [ ] Environment variable `BACKEND_URL` configured
- [ ] First deployment successful
- [ ] Backend URL updated in environment variables
- [ ] CORS settings updated with production URLs
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active (auto by Vercel)

---

## 🎉 You're Live!

Your PolyPortfolio app is now deployed and accessible worldwide!

**Share your deployment URL:**
`https://YOUR-APP-NAME.vercel.app`

For questions or issues, check the Vercel documentation or the project README.

