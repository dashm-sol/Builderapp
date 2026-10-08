// Trading Configuration Constants
export const TRADING_CONSTANTS = {
  // Default number of candles for pattern detection
  DEFAULT_CANDLES: 30,
  MIN_CANDLES: 10,
  MAX_CANDLES: 200,
  
  // Maximum number of trading days to display in day filter dropdown
  MAX_TRADING_DAYS: 10,
  
  // Pattern detection thresholds
  CHART_PATTERN_TOLERANCE: 0.01, // 1% for normal charts
  CHART_PATTERN_TOLERANCE_1MIN: 0.005, // 0.5% for 1-minute charts
  
  // Candlestick pattern thresholds
  DOJI_BODY_RATIO: 0.1, // 10% of range
  MARUBOZU_BODY_RATIO: 0.8, // 80% of range
  SPINNING_TOP_BODY_RATIO: 0.35,
  PIN_BAR_BODY_MULTIPLIER: 3, // Wick to body ratio
  PIN_BAR_OPPOSITE_RATIO: 0.5,
  REVERSAL_BODY_MULTIPLIER: 1.5,
  BREAK_BODY_RATIO: 0.6,
  WICK_RATIO: 0.6,
  WICK_OPPOSITE_RATIO: 0.25,
  
  // Price tolerance thresholds
  PRICE_TOLERANCE_MATCH: 0.005, // 0.5% for matching highs/lows
  PRICE_TOLERANCE_CHART: 0.002, // 0.2% for chart pattern matching
  PRICE_TOLERANCE_BREAKOUT: 0.005, // 0.5% for breakout patterns
  MIN_PRICE_PRECISION: 0.0001, // Minimum price value
  
  // EMA/Technical indicators
  EMA_PERIOD_10: 10,
  EMA_PERIOD_20: 20,
  EMA_PERIOD_50: 50,
  RSI_PERIOD: 14,
  RSI_OVERBOUGHT: 70,
  RSI_OVERSOLD: 30,
  RSI_BULLISH_MIN: 50,
  RSI_BEARISH_MAX: 50,
  
  // Trade levels and risk management
  RISK_REWARD_RATIO: 2, // 1:2 risk-reward ratio
  BREAKOUT_CONSOLIDATION_RATIO: 0.6,
  CONSOLIDATION_RANGE_RATIO: 0.04,
  CUP_HANDLE_RATIO: 0.97,
  SUPPORT_RESISTANCE_RATIO: 0.98,
  
  // EMA Strategy configuration
  EMA_CONTRARIAN_ENTRY_WORSE: 0.002, // 0.2% worse entry
  EMA_TARGET_RATIO: 0.5, // Half the distance
  
  // Market hours (IST - Asia/Kolkata)
  MARKET_OPEN_HOUR: 9,
  MARKET_OPEN_MINUTE: 15,
  MARKET_CLOSE_HOUR: 15,
  MARKET_CLOSE_MINUTE: 40,
  TRADING_CLOSE_HOUR: 15,
  TRADING_CLOSE_MINUTE: 0, // No new trades after 3:00 PM
  
  // Time frame mappings (in seconds)
  TIMEFRAME_SECONDS: {
    minute: 60,
    '3minute': 180,
    '5minute': 300,
    '10minute': 600,
    '15minute': 900,
    '30minute': 1800,
    '60minute': 3600,
    hour: 3600,
    day: 86400,
  },
  
  // Chart data windows
  CHART_WINDOW_SMALL: 20,
  CHART_WINDOW_MEDIUM: 40,
  CHART_WINDOW_LARGE: 100,
  
  // Signal filtering thresholds
  MIN_CANDLES_FOR_SIGNAL: 10,
  MIN_CANDLES_FOR_INSTITUTIONAL: 20,
  MIN_CANDLES_FOR_ONEMIN: 30,
  
  // Brokerage charges
  BROKERAGE_RATE: 0.0003, // 0.03%
  EXCHANGE_RATE: 0.0005, // 0.05%
  GST_RATE: 0.18, // 18%
  STT_RATE: 0.0001, // 0.01%
  STAMP_DUTY_RATE: 0.00003, // 0.003%
  
  // Breakout pattern thresholds
  DOUBLE_BOTTOM_TOLERANCE: 0.005, // 0.5%
  BREAKOUT_PATTERN_TOLERANCE: 0.01, // 1%
  
  // Market state check interval (ms)
  MARKET_CHECK_INTERVAL: 30000, // 30 seconds
  
  // Real-time update intervals (ms)
  CANDLE_UPDATE_CHECK_INTERVAL: 5000, // 5 seconds
};

// Historical Data Configuration
// Adjust the number of days to fetch historical candlestick data
// Current: 7 days (~5 trading days) - covers sufficient data for pattern recognition
// Common values:
//   - 3 days: Only recent data, faster load (~1,200 candles for 1-min)
//   - 7 days: Balanced (default, ~2,500 candles)
//   - 14 days: Extended history (~5,000 candles)
//   - 30 days: Full month (~11,000 candles, slower load)
export const HISTORICAL_DATA_CONFIG = {
  daysToFetch: 7, // ← Change this value to adjust historical data range
  description: '~5 trading days of historical data for pattern recognition'
};

// Signal Quality & Confirmation Rules (Priority 4 Enhancement)
export const SIGNAL_QUALITY_CONFIG = {
  // VWAP Filter
  VWAP_FILTER_ENABLED: true,
  VWAP_DISTANCE_PERCENT: 0.3, // Allow entries within 0.3% of VWAP
  
  // EMA Filter
  EMA_FILTER_ENABLED: true,
  EMA_10_PERIOD: 10,
  EMA_20_PERIOD: 20,
  
  // Minimum confidence score for trading (0-5)
  MIN_CONFIDENCE_SCORE: 1.5, // Simple strategy, lower threshold
};

// VWAP Calculation Config
export const VWAP_CONFIG = {
  typical_price_format: '(H + L + C) / 3',
  cumulative_typical_price_volume: 'SUM(TP * Volume) / SUM(Volume)',
};

// RSI Calculation Config (for future use)
export const RSI_CONFIG = {
  RSI_14_PERIOD: 14,
};

// MACD Calculation Config (for future use)
export const MACD_CONFIG = {
  FAST_PERIOD: 12,
  SLOW_PERIOD: 26,
  SIGNAL_PERIOD: 9,
};

// Available timeframe options
export const TIMEFRAME_OPTIONS = [
  'minute',
  '3minute',
  '5minute',
  '10minute',
  '15minute',
  '30minute',
  '60minute',
  'day',
];

// Signal actions
export const SIGNAL_ACTIONS = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
};

// Signal outcomes
export const SIGNAL_OUTCOMES = {
  PENDING: 'Pending',
  TRUE: 'True',
  FALSE: 'False',
  AMBIGUOUS: 'Ambiguous',
  SESSION_EXIT: 'Session Exit',
};

// Chart pattern categories
export const PATTERN_TYPES = {
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  NEUTRAL: 'neutral',
};

export default TRADING_CONSTANTS;
