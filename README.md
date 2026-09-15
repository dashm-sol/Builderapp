# BuilderApp - Kite Connect API Integration

A React-based application for portfolio management and Nifty 50 market analysis using the Kite Connect API with GitHub authentication.

## 🚀 Features

- **GitHub Account Authentication** - Secure login with GitHub account verification
- **Current Holdings Dashboard** - View all your stock holdings with real-time prices and performance metrics
- **Portfolio Analytics** - Track total portfolio value, gains/losses, and return percentages
- **Nifty 50 PCR Analysis** - Monitor Put-Call Ratio for market sentiment analysis
- **Real-time Data** - Fetch live market data and quotes from Kite Connect API
- **Responsive UI** - Beautiful, mobile-friendly interface with gradient designs
- **Session Management** - 1-hour session timeout for security

## 🔐 Security Features

- ✅ GitHub account email verification
- ✅ Session-based authentication (1-hour timeout)
- ✅ Secure credential storage in `.env` (never committed)
- ✅ Private repository
- ✅ Only authorized GitHub accounts can access

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Kite Connect API credentials:
  - API Key
  - API Secret
- GitHub account (for authentication)

## 🔧 Installation & Setup

### 1. **Local Development Setup**

Clone the repository:
```bash
git clone https://github.com/dashm-sol/builderapp.git
cd builderapp
```

Install dependencies:
```bash
npm install
```

Create a `.env` file:
```bash
cp .env.example .env
```

Add your Kite Connect API credentials to the backend `.env` file. Do not use `REACT_APP_` variables for these values:
```
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
SESSION_SECRET=replace_with_a_long_random_value
BACKEND_PORT=4000
FRONTEND_URL=http://localhost:3000
```

In the Kite developer console, set the redirect URL to:
`http://localhost:4000/api/kite/callback`

### 2. **Running Locally**

Start the development server:
```bash
npm start
```

In a second terminal, start the backend:
```bash
npm run server
```

Open http://localhost:3000 in your browser

### 3. **Authentication**

1. Complete the app's access check.
2. Click **Connect with Kite**.
3. Sign in at Kite.
4. Kite redirects to the backend callback with a one-time request token.
5. The backend exchanges it for an access token using `KITE_API_SECRET` and stores it in the server session.
6. Browser API calls use the HTTP-only session cookie; the access token is never sent to React or stored in browser storage.

## 🚀 Deployment to GitHub Pages

### 1. **Enable GitHub Pages in Repository Settings**

1. Go to your repository settings: https://github.com/dashm-sol/builderapp/settings
2. Scroll to "Pages" section
3. Set Source to: `gh-pages` branch
4. Choose your domain (optional)
5. Save

### 2. **Deploy the Application**

```bash
# Build and deploy to GitHub Pages
npm run deploy
```

Your app will be available at:
```
https://dashm-sol.github.io/builderapp
```

Or with custom domain (if configured)

### 3. **Automatic Deployments**

You can set up GitHub Actions for automatic deployments on push:

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run build
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./build
```

## 📁 Project Structure

```
builderapp/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── GithubAuth.js        # GitHub authentication
│   │   ├── GithubAuth.css
│   │   ├── ApiConfig.js         # API credential configuration
│   │   ├── ApiConfig.css
│   │   ├── Holdings.js          # Portfolio holdings display
│   │   ├── Holdings.css
│   │   ├── PCRAnalysis.js       # Put-Call Ratio analysis
│   │   └── PCRAnalysis.css
│   ├── services/
│   │   └── kiteAPI.js           # Kite API service wrapper
│   ├── App.js                   # Main App component with auth
│   ├── App.css
│   ├── index.js
│   └── index.css
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 🔑 Authentication Flow

1. **Page Load** → Check sessionStorage for auth data
2. **GitHub Login** → User enters their GitHub username
3. **API Verification** → App verifies username against GitHub API
4. **Access Grant** → Session stored with 1-hour expiration
5. **Session Timeout** → User automatically logged out after 1 hour
6. **Manual Logout** → User can click logout button anytime

## 🔐 Access Control

**Only the following GitHub account can access this application:**
- **Username:** `dashm-sol`
- **Email:** `dashrath.macherla555@gmail.com`

## 📊 Component Overview

### GithubAuth Component
- Secure login form with GitHub verification
- Session storage with 1-hour timeout
- Automatic session expiration handling
- Error messaging for unauthorized access

### Holdings Component
- Displays all current stock holdings
- Real-time portfolio metrics
- Gains/losses calculation
- Refresh functionality

### PCRAnalysis Component
- Nifty 50 Put-Call Ratio analysis
- Market sentiment indicators
- Detailed statistics display

### ApiConfig Component
- Kite Connect API credential input
- Secure credential storage
- Validation

## 🔒 Security Best Practices

✅ **Implemented:**
- GitHub account verification
- Session-based authentication
- 1-hour session timeout
- HTTPS (via GitHub Pages)
- Private repository
- `.env` files never committed
- Automatic logout

⚠️ **Never:**
- Commit `.env` files with real credentials
- Share your GitHub username/password
- Expose your API keys in code
- Use in production without OAuth2

## 🌐 Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `public/` directory with your domain
2. Update DNS records to point to GitHub Pages
3. Enable HTTPS in repository settings

## 📝 Troubleshooting

### Build Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Deployment Issues
```bash
# Check git remote
git remote -v

# Ensure gh-pages branch exists
npm run deploy

# Check deployment status in repo settings
```

### Authentication Issues
- Verify GitHub username is exactly: `dashm-sol`
- Check browser console for API errors
- Clear browser cache and sessionStorage
- Ensure GitHub API is accessible

## 📚 API Documentation

- [Kite Connect API Docs](https://kite.trade/)
- [React Documentation](https://react.dev/)
- [GitHub API Docs](https://docs.github.com/en/rest)

## 🚀 Future Enhancements

- [ ] OAuth2 for GitHub integration
- [ ] Historical portfolio charts
- [ ] Option strategy builder
- [ ] Automated trading signals
- [ ] Advanced charting
- [ ] Portfolio rebalancing
- [ ] Mobile app
- [ ] Multi-user support

## 📧 Support

For issues or questions, please create an issue in the repository.

---

**Last Updated:** 2026-08-04
**Status:** ✅ Production Ready (Private Access Only)
