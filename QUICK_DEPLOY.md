# 🚀 Quick Deploy Guide - Start Here!

## Step-by-Step Deployment (5 minutes)

### Step 1: Push Latest Changes to GitHub

```bash
cd /Users/sohamgupta/Desktop/PolyExposure
git add .
git commit -m "Ready for Vercel deployment"
git push
```

### Step 2: Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in with GitHub

2. Click **"Add New..."** → **"Project"**

3. Find and import your **PolyExposure** repository

4. **IMPORTANT - Configure these settings:**
   
   **Framework Preset:** Next.js (should auto-detect)
   
   **Root Directory:** 
   - Click **"Edit"** next to Root Directory
   - Type: `frontend`
   - Click **Save**
   
   **Build & Development Settings:**
   - Build Command: `pnpm build` ✅ (auto)
   - Output Directory: `.next` ✅ (auto)
   - Install Command: `pnpm install` ✅ (auto)

5. Click **"Deploy"** (don't add environment variables yet)

6. Wait 2-3 minutes for deployment to complete

### Step 3: Get Your URL

After deployment succeeds:
- Copy your deployment URL (e.g., `https://poly-exposure-xyz.vercel.app`)

### Step 4: Set Backend URL (Optional for now)

If you want the PNL/Positions features to work, you'll need to deploy the backend separately:

**Option A: Deploy Backend to Railway (Free, Easy)**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy backend
cd /Users/sohamgupta/Desktop/PolyExposure/backend
railway login
railway init
railway up
```

Then add the Railway URL as `BACKEND_URL` in Vercel:
- Vercel Dashboard → Your Project → Settings → Environment Variables
- Add: `BACKEND_URL` = `https://your-backend.railway.app`
- Redeploy

**Option B: Skip for now**
- The app will still work for viewing markets
- PNL/Positions features will show errors until backend is deployed

## ✅ Done!

Your app should now be live at your Vercel URL!

Test it by:
1. Opening the URL in your browser
2. You should see the PolyPortfolio interface

## 🐛 Troubleshooting

**Still getting 404?**
- Make sure Root Directory is set to `frontend` in Vercel settings
- Redeploy the project

**Build fails?**
- Check the build logs in Vercel
- Make sure your GitHub repo has all the latest files

**Need help?**
- Check the detailed [DEPLOYMENT.md](DEPLOYMENT.md)

