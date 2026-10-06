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
