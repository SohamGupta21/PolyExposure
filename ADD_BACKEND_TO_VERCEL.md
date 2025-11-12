# 🔗 Connect Backend to Frontend

Your backend is working! Now connect it to Vercel.

## Step-by-Step:

### 1. Get Your Render URL

Your backend URL is something like:
- `https://polyportfolio-backend.onrender.com`
- Or whatever URL shows in your Render dashboard

**Copy the EXACT URL** (without `/health` or `/docs` at the end)

### 2. Add to Vercel

1. Go to **[vercel.com](https://vercel.com/dashboard)**
2. Click on your **PolyExposure** project
3. Click **"Settings"** (top navigation)
4. Click **"Environment Variables"** (left sidebar)
5. Click **"Add New"** button

6. Fill in:
   ```
   Key:   BACKEND_URL
   Value: https://your-render-url.onrender.com
   ```
   ⚠️ **Important**: Paste your ACTUAL Render URL!
   
7. Under "Environment":
   - Check ✅ **Production**
   - Check ✅ **Preview** (optional)
   - Check ✅ **Development** (optional)

8. Click **"Save"**

### 3. Redeploy Your App

This is CRITICAL - environment variables only apply to new deployments!

1. Stay in Vercel dashboard
2. Click **"Deployments"** (top navigation)
3. Find the latest deployment (top of the list)
4. Click the **"..."** (three dots) menu on the right
5. Click **"Redeploy"**
6. Confirm by clicking **"Redeploy"** again

### 4. Wait for Deployment (1-2 minutes)

Watch the deployment progress. When it says "Ready", your app is updated!

### 5. Test Your App

1. Go to your Vercel app URL
2. Enter a Polymarket wallet address (try: `0x...` any valid address)
3. Click Analyze
4. Should work now! 🎉

## 🧪 Test Wallet Addresses

Try these real Polymarket wallets:
- `0x74E06d4569FaE89BDcDf5dd2e1a2d7b2A1e8859E`
- Or any valid Ethereum address that has Polymarket activity

## ✅ Checklist

- [ ] Backend URL copied from Render
- [ ] Environment variable added in Vercel
- [ ] App redeployed
- [ ] Tested with a wallet address

## 🐛 Still Not Working?

Check these:
1. **Environment variable is correct?**
   - Should be: `https://your-url.onrender.com`
   - NO trailing slash!
   - NO `/api` at the end!

2. **Did you redeploy?**
   - Environment variables ONLY work after redeploying

3. **Check deployment logs:**
   - Vercel Dashboard → Deployments → Click on latest
   - Look for any errors in the logs

4. **Backend sleeping?**
   - Free tier sleeps after 15 min
   - Visit `https://your-backend.onrender.com/health` to wake it up
   - Wait 30 seconds, then try your app again

