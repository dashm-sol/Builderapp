# BuilderApp - Kite Connect API Integration

A React-based application for portfolio management and Nifty 50 market analysis using the Kite Connect API.

## 🚀 Features

- **Current Holdings Dashboard** - View all your stock holdings with real-time prices and performance metrics
- **Portfolio Analytics** - Track total portfolio value, gains/losses, and return percentages
- **Nifty 50 PCR Analysis** - Monitor Put-Call Ratio for market sentiment analysis
- **Real-time Data** - Fetch live market data and quotes from Kite Connect API
- **Responsive UI** - Beautiful, mobile-friendly interface with gradient designs

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Kite Connect API credentials:
  - API Key
  - API Secret
  - Access Token
  - Public Token (optional)

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/dashm-sol/builderapp.git
cd builderapp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Add your Kite Connect API credentials to `.env`:
```
REACT_APP_KITE_API_KEY=your_api_key_here
REACT_APP_KITE_API_SECRET=your_api_secret_here
REACT_APP_KITE_ACCESS_TOKEN=your_access_token_here
REACT_APP_KITE_PUBLIC_TOKEN=your_public_token_here
```

## 🏃 Running the Application

1. Start the development server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Enter your Kite Connect API credentials in the configuration form

4. View your holdings and Nifty 50 PCR analysis

## 📁 Project Structure

```
builderapp/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── ApiConfig.js         # API credential configuration
│   │   ├── ApiConfig.css
│   │   ├── Holdings.js          # Portfolio holdings display
│   │   ├── Holdings.css
│   │   ├── PCRAnalysis.js       # Put-Call Ratio analysis
│   │   └── PCRAnalysis.css
│   ├── services/
│   │   └── kiteAPI.js           # Kite API service wrapper
│   ├── App.js                   # Main App component
│   ├── App.css
│   ├── index.js
│   └── index.css
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 🔑 API Components

### ApiConfig Component
- Form to input and validate Kite Connect credentials
- Stores credentials securely in localStorage
- Input validation for required fields

### Holdings Component
- Displays all current stock holdings
- Shows quantity, average cost, current price
- Calculates and displays gains/losses
- Real-time portfolio metrics
- Refresh functionality for live updates

### PCRAnalysis Component
- Put-Call Ratio analysis for Nifty 50
- PCR Volume and Open Interest metrics
- Market sentiment indicators
- Nifty 50 index information
- Educational section on PCR interpretation

### KiteAPI Service
- Wrapper around Kite Connect REST API
- Methods for:
  - Fetching holdings
  - Getting quote data
  - Retrieving Nifty 50 index data
  - Fetching option chain data

## 📊 Key Metrics Explained

### Portfolio Metrics
- **Total Portfolio Value**: Current market value of all holdings
- **Gain/Loss**: Absolute and percentage returns
- **Holdings Count**: Number of stocks held

### PCR Metrics
- **PCR Volume**: Ratio of put volume to call volume
- **PCR OI**: Ratio of put open interest to call open interest
- **Sentiment**: Market sentiment based on PCR values
  - PCR < 1.0: Bullish
  - PCR = 1.0: Neutral
  - PCR > 1.0: Bearish

## 🔒 Security Notes

⚠️ **Important**: Your API credentials are stored locally in your browser's localStorage. 

For production use:
- Never commit `.env` files with real credentials
- Consider using a backend authentication service
- Implement token refresh mechanisms
- Use HTTPS only
- Regular credential rotation

## 🚀 Future Enhancements

- [ ] Historical portfolio performance charts
- [ ] Option strategy builder
- [ ] Automated trading signals
- [ ] Advanced charting with TradingView
- [ ] Portfolio rebalancing suggestions
- [ ] Sentiment analysis with news integration
- [ ] Mobile app version
- [ ] Backend API for secure credential management

## 📝 License

This project is private and confidential.

## 🤝 Support

For issues or feature requests, please contact the project maintainer.

## 📚 Resources

- [Kite Connect API Documentation](https://kite.trade/)
- [React Documentation](https://react.dev/)
- [Axios Documentation](https://axios-http.com/)

---

**Note**: This is a development/learning project. Always test thoroughly before using with real trading credentials.
