# 🚀 Deploy Backend to Render (Free)

Railway requires a paid plan, so let's use Render instead!

## Step 1: Push Your Code (if not done)

```bash
cd /Users/sohamgupta/Desktop/PolyExposure
git add .
git commit -m "Ready for Render deployment"
git push
```

## Step 2: Deploy on Render

### Option A: Using render.yaml (Auto-configure)

1. Go to **[render.com](https://render.com)**
2. Click **"Get Started for Free"** (or Login if you have an account)
3. Sign up/in with **GitHub**
4. Click **"New +"** → **"Blueprint"**
5. Click **"Connect account"** to connect GitHub
6. Find and select **PolyExposure** repository
7. Give the blueprint a name (e.g., "PolyExposure Backend")
8. Click **"Apply"**

Render will detect the `render.yaml` file and auto-configure everything!

### Option B: Manual Setup (if Blueprint doesn't work)

1. Go to **[render.com](https://render.com)**
2. Click **"New +"** → **"Web Service"**
3. Connect your **PolyExposure** repository
4. Configure:
   - **Name**: `polyportfolio-backend`
   - **Region**: Oregon (or closest to you)
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Scroll down to **"Instance Type"**
   - Select: **Free**
6. Click **"Create Web Service"**

## Step 3: Wait for Deployment (3-5 minutes)

Render will:
- Install dependencies
- Start your FastAPI server
- Give you a URL

## Step 4: Get Your Backend URL

After deployment completes:
- You'll see your app URL at the top (looks like: `https://polyportfolio-backend.onrender.com`)
- **Copy this URL**

## Step 5: Add URL to Vercel

1. Go to **[vercel.com](https://vercel.com)** → Your project
2. Click **"Settings"** → **"Environment Variables"**
3. Click **"Add New"**:
   - **Name**: `BACKEND_URL`
   - **Value**: `https://polyportfolio-backend.onrender.com` (your Render URL)
   - **Environment**: Production (and Preview if you want)
4. Click **"Save"**
5. Go to **"Deployments"** tab
6. Click the **"..."** menu on the latest deployment
7. Click **"Redeploy"**

## ✅ Done!

Your backend is now live on Render (free tier) and connected to your Vercel frontend!

## ⚠️ Important Notes

### Free Tier Limitations:
- **Cold starts**: Free services spin down after 15 minutes of inactivity
- First request after inactivity may take 30-60 seconds (waking up the service)
- This is normal for free tier - paid tier ($7/mo) has no cold starts

### Keep Service Warm (Optional):
You can use a service like **UptimeRobot** or **Cron-job.org** to ping your backend every 10 minutes to keep it awake.

## 🔒 Optional: Add CORS Security

In Render dashboard:
1. Go to your service → **Environment** tab
2. Add environment variable:
   - **Key**: `ALLOWED_ORIGINS`
   - **Value**: `https://your-vercel-app.vercel.app`
3. Click **"Save Changes"**

This restricts your backend to only accept requests from your frontend.

## 🐛 Troubleshooting

**Build fails?**
- Check the build logs in Render dashboard
- Make sure all files are pushed to GitHub

**Service URL not working?**
- Wait a few minutes after deployment
- Check the logs in Render dashboard
- Free tier has cold starts - first request is slow

**Still issues?**
- Check that `backend/requirements.txt` has all dependencies
- Verify `backend/main.py` doesn't have syntax errors

