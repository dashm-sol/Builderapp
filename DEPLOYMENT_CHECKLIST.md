# BuilderApp Deployment Checklist

Use this checklist for all future deployments and updates.

---

## Pre-Deployment Checklist

- [ ] All code changes are complete and tested locally
- [ ] No sensitive data (API keys, passwords) in code
- [ ] `.env` file is in `.gitignore` (check `.gitignore`)
- [ ] All dependencies are installed: `npm install`
- [ ] Code builds successfully locally: `npm run build`
- [ ] No critical ESLint errors (warnings are OK)
- [ ] Git working directory is clean: `git status`

---

## Deployment Steps

### Step 1: Commit Changes to Git
```bash
# Check status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Feature: your change description"
```

### Step 2: Push to GitHub
```bash
# Push to main branch
git push origin main
```

### Step 3: Deploy to GitHub Pages
```bash
# Execute deployment
npm run deploy
```

### Step 4: Verify Deployment
```bash
# Check git branches
git branch -r

# Verify gh-pages branch exists
# Output should show: origin/gh-pages
```

---

## Post-Deployment Verification

- [ ] Visit: https://dashm-sol.github.io/builderapp
- [ ] Page loads without 404 error
- [ ] All interactive features work correctly
- [ ] No console errors (F12 → Console)
- [ ] Responsive design works on mobile
- [ ] API calls are working (check Network tab)
- [ ] Authentication flow works
- [ ] Data displays correctly

---

## Troubleshooting During Deployment

### Build Fails
```bash
# Clear cache and reinstall
rm -r node_modules package-lock.json build
npm install
npm run build
```

### Deploy Fails
```bash
# Check git status
git status

# Ensure all changes are committed
git add .
git commit -m "message"
git push origin main

# Try deploy again
npm run deploy
```

### Page Still Shows Old Content
```bash
# Wait 5-10 minutes for CDN propagation
# Then clear browser cache and hard refresh (Ctrl+Shift+R)
```

---

## Rollback Procedure (If Needed)

### Revert to Previous Deployment
```bash
# Find previous commit SHA
git log --oneline -10

# Revert to previous commit
git reset --hard <commit-sha>

# Force push to main
git push origin main --force

# Redeploy
npm run deploy
```

---

## Common Deployment Commands

```bash
# Build only
npm run build

# Deploy to GitHub Pages
npm run deploy

# Build and deploy (combined)
npm run predeploy && npm run deploy

# Check git status
git status

# View deployment history
git log --oneline -10

# Check branches
git branch -a
```

---

## Environment Variables

### Local Development (.env)
```
REACT_APP_API_URL=http://localhost:4000
REACT_APP_DEBUG=true
```

### GitHub Pages Deployment
- .env files should NOT be pushed to GitHub
- Use .env.example as template
- Keep sensitive data locally only
- Use GitHub Secrets for CI/CD variables (if needed)

---

## Deployment Schedule

- **Testing:** After every major feature
- **Staging:** Before releasing to production
- **Production:** When ready for public access
- **Frequency:** As needed, typically 1-2 times per week

---

## Performance Monitoring

### Check Build Size
```bash
npm run build
# Check build/ folder size
```

### Monitor Deployment Time
- Typical build time: 30-60 seconds
- Typical deploy time: 10-30 seconds
- CDN propagation: 1-10 minutes

---

## Security Checklist

- [ ] No API keys in code
- [ ] No passwords in code
- [ ] .env file in .gitignore
- [ ] Repository is private (or public with no secrets)
- [ ] No sensitive data in git history
- [ ] HTTPS enabled (automatic via GitHub Pages)
- [ ] Authentication implemented

---

## GitHub Pages Settings

### Verify Repository Settings
1. Go to: https://github.com/dashm-sol/Builderapp/settings/pages
2. Check:
   - [ ] Source: Branch `gh-pages`
   - [ ] Enforce HTTPS: Enabled
   - [ ] Custom domain: (if configured)
   - [ ] Subdomain check: Pass

---

## Documentation Updates

After deployment, update documentation if needed:
- [ ] Update DEPLOYMENT_QUICK_GUIDE.md
- [ ] Update DEPLOYMENT_SUMMARY.md
- [ ] Update README.md if features changed
- [ ] Update changelog (if maintaining one)

---

## Post-Deployment Tasks

- [ ] Notify stakeholders of new deployment
- [ ] Monitor for issues in production
- [ ] Check analytics/logs (if configured)
- [ ] Get user feedback
- [ ] Plan next features
- [ ] Schedule next deployment

---

## Quick Links

- **Live App:** https://dashm-sol.github.io/builderapp
- **Repository:** https://github.com/dashm-sol/Builderapp
- **Pages Settings:** https://github.com/dashm-sol/Builderapp/settings/pages
- **Deployment Commits:** https://github.com/dashm-sol/Builderapp/commits/gh-pages
- **Actions (if enabled):** https://github.com/dashm-sol/Builderapp/actions

---

## Notes for Team

### Before You Deploy
- Review your changes one more time
- Run `npm run build` to check for errors
- Test locally in multiple browsers
- Verify all new features work

### After You Deploy
- Visit the live site and confirm changes
- Test all functionality one more time
- Monitor for user feedback
- Be ready to rollback if issues arise

---

## Emergency Contacts

If deployment fails and you need help:
1. Check build logs: `npm run build`
2. Check git status: `git status`
3. Review recent commits: `git log -10`
4. Check GitHub Pages settings
5. Clear npm cache: `npm cache clean --force`

---

## Version History

| Date | Deployed By | Changes | Status |
|------|-------------|---------|--------|
| 2026-10-07 | Initial Deploy | First deployment to GitHub Pages | ✅ |
| | | | |
| | | | |

---

**Last Updated:** October 7, 2026  
**Version:** 1.0.0  
**Status:** ✅ Active
