import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { createChart, createSeriesMarkers, CandlestickSeries, LineSeries } from 'lightweight-charts';
import './PCRAnalysis.css';
import KiteAPI from '../services/kiteAPI';
import CandlestickChart from './CandlestickChart';
import AutoTradePanel from './AutoTradePanel';
import { TRADING_CONSTANTS, TIMEFRAME_OPTIONS as TIMEFRAME_OPTIONS_CONST, SIGNAL_ACTIONS, SIGNAL_OUTCOMES, HISTORICAL_DATA_CONFIG, SIGNAL_QUALITY_CONFIG } from '../services/tradingConstants';

ChartJS.register(
  LinearScale,
  TimeScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
);

const TIMEFRAME_OPTIONS = TIMEFRAME_OPTIONS_CONST;

function calculateEma(candles, period) {
  const multiplier = 2 / (period + 1);
  let ema = candles[0]?.c || 0;
  return candles.map((candle, index) => {
    ema = index === 0 ? candle.c : ((candle.c - ema) * multiplier) + ema;
    return { time: Math.floor(candle.x / 1000), value: ema };
  });
}

// ==================== PRIORITY 4: SIGNAL QUALITY ENHANCEMENTS ====================

// Calculate VWAP (Volume Weighted Average Price)
function calculateVwap(candles) {
  let cumulativeTPV = 0; // Cumulative (Typical Price × Volume)
  let cumulativeVolume = 0;

  return candles.map((candle, index) => {
    // Typical Price = (High + Low + Close) / 3
    const typicalPrice = (candle.h + candle.l + candle.c) / 3;
    // Assume volume is 1 if not provided (for OHLC data)
    const volume = candle.v || 1;

    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    // VWAP = Cumulative TPV / Cumulative Volume
    const vwap = cumulativeTPV / Math.max(cumulativeVolume, 1);

    return {
      time: Math.floor(candle.x / 1000),
      value: Number(vwap.toFixed(2)),
    };
  });
}

// Check if price is above VWAP (bullish) or below (bearish)
function getVwapAlignment(currentPrice, vwapValue) {
  if (!vwapValue) return null;
  const distance = Math.abs(currentPrice - vwapValue);
  const percentDistance = (distance / vwapValue) * 100;

  if (currentPrice > vwapValue) {
    return {
      alignment: 'BULLISH',
      distance,
      percentDistance,
      isAligned: true,
    };
  } else if (currentPrice < vwapValue) {
    return {
      alignment: 'BEARISH',
      distance,
      percentDistance,
      isAligned: true,
    };
  }
  return null;
}

// Calculate average volume of last N candles
function getAverageVolume(candles, lookback = 20) {
  const recentCandles = candles.slice(-lookback);
  const totalVolume = recentCandles.reduce((sum, candle) => sum + (candle.v || 1), 0);
  return totalVolume / Math.max(recentCandles.length, 1);
}

// Check if current volume confirms the move (above average)
function getVolumeConfirmation(currentCandle, averageVolume) {
  const currentVolume = currentCandle.v || 1;
  const threshold = averageVolume * SIGNAL_QUALITY_CONFIG.VOLUME_THRESHOLD_MULTIPLIER;
  return {
    currentVolume,
    averageVolume,
    threshold,
    isConfirmed: currentVolume >= threshold,
    ratio: (currentVolume / averageVolume).toFixed(2),
  };
}

// Calculate multi-timeframe bias by comparing EMA positions
function getMultiTimeframeBias(candles) {
  if (candles.length < 50) return null;

  const ema20 = calculateEma(candles, 20);
  const ema50 = calculateEma(candles, 50);
  const lastPrice = candles[candles.length - 1].c;
  const lastEma20 = ema20[ema20.length - 1]?.value || 0;
  const lastEma50 = ema50[ema50.length - 1]?.value || 0;

  // Bullish bias: Price > EMA20 > EMA50
  const bullishBias = lastPrice > lastEma20 && lastEma20 > lastEma50;
  // Bearish bias: Price < EMA20 < EMA50
  const bearishBias = lastPrice < lastEma20 && lastEma20 < lastEma50;

  return {
    bias: bullishBias ? 'BULLISH' : bearishBias ? 'BEARISH' : 'NEUTRAL',
    isBullish: bullishBias,
    isBearish: bearishBias,
    priceVsEma20: lastPrice > lastEma20 ? 'ABOVE' : 'BELOW',
    ema20VsEma50: lastEma20 > lastEma50 ? 'ABOVE' : 'BELOW',
  };
}

// Calculate signal confidence score (0-5)
function calculateSignalConfidence(signal, vwapAlignment, volumeConfirm, multiTFBias, hasPattern) {
  let score = 0;

  // Candlestick pattern confirmation (+1.0)
  if (hasPattern) score += 1.0;

  // VWAP alignment confirmation (+0.8)
  if (SIGNAL_QUALITY_CONFIG.VWAP_FILTER_ENABLED && vwapAlignment?.isAligned) {
    const signalDirection = signal.action === 'BUY' ? 'BULLISH' : 'BEARISH';
    if (vwapAlignment.alignment === signalDirection) {
      score += 0.8;
    }
  }

  // Volume confirmation (+0.7)
  if (SIGNAL_QUALITY_CONFIG.VOLUME_CONFIRMATION_ENABLED && volumeConfirm?.isConfirmed) {
    score += 0.7;
  }

  // EMA support confirmation (+0.8)
  if (SIGNAL_QUALITY_CONFIG.EMA_FILTER_ENABLED && multiTFBias) {
    const signalDirection = signal.action === 'BUY' ? 'bullish' : 'bearish';
    const isBullish = signalDirection === 'bullish';
    if ((isBullish && multiTFBias.isBullish) || (!isBullish && multiTFBias.isBearish)) {
      score += 0.8;
    }
  }

  // Multi-timeframe bias alignment (+0.9)
  if (SIGNAL_QUALITY_CONFIG.MULTI_TF_BIAS_ENABLED && multiTFBias) {
    const signalDirection = signal.action === 'BUY' ? 'BULLISH' : 'BEARISH';
    if (multiTFBias.bias === signalDirection) {
      score += 0.9;
    }
  }

  return Number(score.toFixed(2));
}

// ==================== END SIGNAL QUALITY ENHANCEMENTS ====================

function calculateRsi(candles, period = TRADING_CONSTANTS.RSI_PERIOD) {
  return candles.map((candle, index) => {
    if (index < period) return { x: candle.x, y: null };
    let gains = 0;
    let losses = 0;
    for (let offset = index - period + 1; offset <= index; offset += 1) {
      const change = candles[offset].c - candles[offset - 1].c;
      if (change >= 0) gains += change;
      else losses -= change;
    }
    const averageGain = gains / period;
    const averageLoss = losses / period;
    const value = averageLoss === 0 ? 100 : 100 - (100 / (1 + (averageGain / averageLoss)));
    return { x: candle.x, y: Number(value.toFixed(2)) };
  });
}

function detectCandlestickPatterns(candles, index) {
  const current = candles[index];
  const previous = candles[index - 1];
  const beforePrevious = candles[index - 2];
  const threeBack = candles[index - 3];
  if (!current || !previous) return { bullish: [], bearish: [], neutral: [] };
  const body = Math.abs(current.c - current.o);
  const range = Math.max(current.h - current.l, TRADING_CONSTANTS.MIN_PRICE_PRECISION);
  const upperWick = current.h - Math.max(current.o, current.c);
  const lowerWick = Math.min(current.o, current.c) - current.l;
  const bullish = [];
  const bearish = [];
  const neutral = [];
  const isBull = current.c > current.o;
  const isBear = current.c < current.o;
  const smallBody = body <= range * TRADING_CONSTANTS.DOJI_BODY_RATIO;
  const previousRange = previous ? Math.max(previous.h - previous.l, TRADING_CONSTANTS.MIN_PRICE_PRECISION) : TRADING_CONSTANTS.MIN_PRICE_PRECISION;
  const previousBody = previous ? Math.abs(previous.c - previous.o) : 0;
  const previousDoji = previousBody <= previousRange * TRADING_CONSTANTS.DOJI_BODY_RATIO;
  const bullishEngulfing = isBull && previous.c < previous.o && current.o <= previous.c && current.c >= previous.o;
  const bearishEngulfing = isBear && previous.c > previous.o && current.o >= previous.c && current.c <= previous.o;

  if (smallBody) neutral.push('Doji');
  if (smallBody && lowerWick >= range * TRADING_CONSTANTS.WICK_RATIO) bullish.push('Dragonfly doji');
  if (smallBody && upperWick >= range * TRADING_CONSTANTS.WICK_RATIO) bearish.push('Gravestone doji');
  if (body <= range * TRADING_CONSTANTS.SPINNING_TOP_BODY_RATIO && upperWick >= body && lowerWick >= body) neutral.push('Spinning top');
  if (isBull && body >= range * TRADING_CONSTANTS.MARUBOZU_BODY_RATIO) bullish.push('Bullish marubozu');
  if (isBear && body >= range * TRADING_CONSTANTS.MARUBOZU_BODY_RATIO) bearish.push('Bearish marubozu');
  if (isBull && lowerWick >= body * 2 && upperWick <= range * TRADING_CONSTANTS.WICK_OPPOSITE_RATIO) bullish.push('Hammer');
  if (isBull && upperWick >= body * 2 && lowerWick <= range * TRADING_CONSTANTS.WICK_OPPOSITE_RATIO) bullish.push('Inverted hammer');
  if (isBear && lowerWick >= body * 2 && upperWick <= range * TRADING_CONSTANTS.WICK_OPPOSITE_RATIO) bearish.push('Hanging man');
  if (isBear && upperWick >= body * 2 && lowerWick <= range * TRADING_CONSTANTS.WICK_OPPOSITE_RATIO) bearish.push('Shooting star');
  if (bullishEngulfing) bullish.push('Bullish engulfing');
  if (bearishEngulfing) bearish.push('Bearish engulfing');
  if (previous.c < previous.o && isBull && current.o <= previous.c && current.c > (previous.o + previous.c) / 2) bullish.push('Piercing line');
  if (previous.c > previous.o && isBear && current.o >= previous.c && current.c < (previous.o + previous.c) / 2) bearish.push('Dark cloud cover');
  if (Math.abs(current.l - previous.l) / Math.max(previous.l, TRADING_CONSTANTS.MIN_PRICE_PRECISION) < TRADING_CONSTANTS.PRICE_TOLERANCE_CHART && isBull) bullish.push('Tweezer bottom');
  if (Math.abs(current.h - previous.h) / Math.max(previous.h, TRADING_CONSTANTS.MIN_PRICE_PRECISION) < TRADING_CONSTANTS.PRICE_TOLERANCE_CHART && isBear) bearish.push('Tweezer top');

  // 1-Minute Specific Patterns (High Probability for Scalping)
  // Pin Bar / Rejection Candle (long wick, small body at opposite end)
  const pinBarThreshold = range * TRADING_CONSTANTS.PIN_BAR_OPPOSITE_RATIO;
  if (isBull && lowerWick >= body * TRADING_CONSTANTS.PIN_BAR_BODY_MULTIPLIER && upperWick <= body * TRADING_CONSTANTS.PIN_BAR_OPPOSITE_RATIO) bullish.push('Pin bar up');
  if (isBear && upperWick >= body * TRADING_CONSTANTS.PIN_BAR_BODY_MULTIPLIER && lowerWick <= body * TRADING_CONSTANTS.PIN_BAR_OPPOSITE_RATIO) bearish.push('Pin bar down');

  // Strong Reversal (opposite to previous trend with conviction)
  if (previous && previous.c < previous.o && isBull && body >= previousBody * TRADING_CONSTANTS.REVERSAL_BODY_MULTIPLIER) bullish.push('Strong reversal up');
  if (previous && previous.c > previous.o && isBear && body >= previousBody * TRADING_CONSTANTS.REVERSAL_BODY_MULTIPLIER) bearish.push('Strong reversal down');

  // Break of Previous Candle (aggressive directional move)
  if (isBull && current.c > previous.h && body >= range * TRADING_CONSTANTS.BREAK_BODY_RATIO) bullish.push('Break above previous');
  if (isBear && current.c < previous.l && body >= range * TRADING_CONSTANTS.BREAK_BODY_RATIO) bearish.push('Break below previous');

  if (beforePrevious) {
    if (beforePrevious.c < beforePrevious.o && previous.c < previous.o && isBull && current.c > beforePrevious.o) bullish.push('Morning star');
    if (beforePrevious.c > beforePrevious.o && previous.c > previous.o && isBear && current.c < beforePrevious.o) bearish.push('Evening star');
    if (isBull && previous.c > previous.o && beforePrevious.c > beforePrevious.o) bullish.push('Three white soldiers');
    if (isBear && previous.c < previous.o && beforePrevious.c < beforePrevious.o) bearish.push('Three black crows');
    if (current.h < previous.h && current.l > previous.l) neutral.push('Inside bar');
    if (current.h > previous.h && current.l < previous.l) neutral.push('Outside bar');
    if (isBull && previous.c < previous.o && current.o > previous.o && current.c < previous.c) bearish.push('Bearish harami');
    if (isBear && previous.c > previous.o && current.o < previous.o && current.c > previous.c) bullish.push('Bullish harami');

    if (threeBack) {
      const threeBackBear = threeBack.c < threeBack.o;
      const threeBackBull = threeBack.c > threeBack.o;
      const bullishHarami = threeBackBear && previousBody < Math.abs(threeBack.c - threeBack.o) * 0.6
        && previous.o >= threeBack.c && previous.c <= threeBack.o;
      const bearishHarami = threeBackBull && previousBody < Math.abs(threeBack.c - threeBack.o) * 0.6
        && previous.o <= threeBack.c && previous.c >= threeBack.o;
      if (threeBackBear && previousDoji && isBull && current.c > threeBack.o) bullish.push('Morning doji star');
      if (threeBackBull && previousDoji && isBear && current.c < threeBack.o) bearish.push('Evening doji star');
      if (threeBackBear && previousDoji && isBull && previous.l > threeBack.h && current.l > previous.h) bullish.push('Bullish abandoned baby');
      if (threeBackBull && previousDoji && isBear && previous.h < threeBack.l && current.h < previous.l) bearish.push('Bearish abandoned baby');
      if (bullishHarami && isBull && current.c > threeBack.o) bullish.push('Three inside up');
      if (bearishHarami && isBear && current.c < threeBack.o) bearish.push('Three inside down');
    }
  }
  return { bullish, bearish, neutral };
}

function findChartPatterns(candles, isOneMinute = false, numCandles = TRADING_CONSTANTS.DEFAULT_CANDLES) {
  const recent = candles.slice(-numCandles);
  const highs = recent.filter((candle, index) => index > 0 && index < recent.length - 1 && candle.h >= recent[index - 1].h && candle.h >= recent[index + 1].h);
  const lows = recent.filter((candle, index) => index > 0 && index < recent.length - 1 && candle.l <= recent[index - 1].l && candle.l <= recent[index + 1].l);

  // For 1-minute trading, use tighter tolerance (0.5% instead of 1%)
  const tolerance = isOneMinute ? TRADING_CONSTANTS.CHART_PATTERN_TOLERANCE_1MIN : TRADING_CONSTANTS.CHART_PATTERN_TOLERANCE;
  const matchLevel = (items, field) => items.length >= 2 && Math.abs(items.at(-1)[field] - items.at(-2)[field]) / Math.max(items.at(-2)[field], TRADING_CONSTANTS.MIN_PRICE_PRECISION) < tolerance;
  const patterns = [];
  if (highs.length >= 3 && matchLevel(highs, 'h')) patterns.push('Triple top');
  else if (highs.length >= 2 && matchLevel(highs, 'h')) patterns.push('Double top');
  if (lows.length >= 3 && matchLevel(lows, 'l')) patterns.push('Triple bottom');
  else if (lows.length >= 2 && matchLevel(lows, 'l')) patterns.push('Double bottom');
  if (highs.length >= 2 && lows.length >= 2) {
    if (highs.at(-1).h < highs.at(-2).h && lows.at(-1).l > lows.at(-2).l) patterns.push('Symmetrical triangle');
    if (highs.at(-1).h <= highs.at(-2).h && lows.at(-1).l > lows.at(-2).l) patterns.push('Descending triangle');
    if (highs.at(-1).h > highs.at(-2).h && lows.at(-1).l >= lows.at(-2).l) patterns.push('Ascending triangle');
  }
  if (highs.length >= 3 && lows.length >= 2) {
    const peakA = highs.at(-3).h;
    const head = highs.at(-2).h;
    const peakB = highs.at(-1).h;
    if (head > peakA * 1.01 && head > peakB * 1.01) patterns.push('Head and shoulders');
  }
  if (lows.length >= 3 && highs.length >= 2) {
    const troughA = lows.at(-3).l;
    const head = lows.at(-2).l;
    const troughB = lows.at(-1).l;
    if (head < troughA * 0.99 && head < troughB * 0.99) patterns.push('Inverse head and shoulders');
  }
  const first = recent[0];
  const last = recent.at(-1);
  if (first && last) {
    if (last.c > first.c && lows.length >= 2) patterns.push('Rising channel');
    if (last.c < first.c && highs.length >= 2) patterns.push('Falling channel');
  }
  const closingPrices = recent.map(candle => candle.c);
  const firstThird = closingPrices.slice(0, Math.max(2, Math.floor(closingPrices.length / 3)));
  const middleThird = closingPrices.slice(Math.floor(closingPrices.length / 3), Math.floor((closingPrices.length * 2) / 3));
  const finalThird = closingPrices.slice(Math.floor((closingPrices.length * 2) / 3));
  const average = values => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  if (firstThird.length && middleThird.length && finalThird.length) {
    const firstAverage = average(firstThird);
    const middleAverage = average(middleThird);
    const finalAverage = average(finalThird);
    if (middleAverage < firstAverage * 0.98 && finalAverage > middleAverage * 1.02 && Math.abs(finalAverage - firstAverage) / firstAverage < 0.03) patterns.push('Rounding bottom');
    if (middleAverage > firstAverage * 1.02 && finalAverage < middleAverage * 0.98 && Math.abs(finalAverage - firstAverage) / firstAverage < 0.03) patterns.push('Rounding top');
  }
  if (highs.length >= 2 && lows.length >= 2) {
    const highSlope = highs.at(-1).h - highs.at(-2).h;
    const lowSlope = lows.at(-1).l - lows.at(-2).l;
    if (highSlope < 0 && lowSlope < 0 && Math.abs(highSlope) < Math.abs(lowSlope)) patterns.push('Rising wedge');
    if (highSlope > 0 && lowSlope > 0 && Math.abs(highSlope) < Math.abs(lowSlope)) patterns.push('Falling wedge');
  }
  if (recent.length >= 8) {
    const poleStart = recent[0].c;
    const poleEnd = recent[Math.floor(recent.length / 2)].c;
    const consolidation = recent.slice(Math.floor(recent.length / 2));
    const consolidationRange = Math.max(...consolidation.map(candle => candle.h)) - Math.min(...consolidation.map(candle => candle.l));
    const poleMove = Math.abs(poleEnd - poleStart);
    const consolidationHighs = consolidation.filter((candle, index) => index > 0 && index < consolidation.length - 1
      && candle.h >= consolidation[index - 1].h && candle.h >= consolidation[index + 1].h);
    const consolidationLows = consolidation.filter((candle, index) => index > 0 && index < consolidation.length - 1
      && candle.l <= consolidation[index - 1].l && candle.l <= consolidation[index + 1].l);
    const consolidationHighSlope = consolidationHighs.length >= 2
      ? consolidationHighs.at(-1).h - consolidationHighs.at(-2).h : 0;
    const consolidationLowSlope = consolidationLows.length >= 2
      ? consolidationLows.at(-1).l - consolidationLows.at(-2).l : 0;
    if (poleMove > 0 && consolidationRange < poleMove * 0.6) {
      if (poleEnd > poleStart) patterns.push('Bull flag');
      if (poleEnd < poleStart) patterns.push('Bear flag');
      if (consolidationHighSlope && consolidationLowSlope
        && Math.sign(consolidationHighSlope) !== Math.sign(consolidationLowSlope)) {
        patterns.push(poleEnd > poleStart ? 'Bullish pennant' : 'Bearish pennant');
      }
    }
  }
  if (recent.length >= 12) {
    const cupStart = recent[0].c;
    const cupMiddle = recent[Math.floor(recent.length / 2)].c;
    const cupEnd = recent.at(-1).c;
    if (cupMiddle < cupStart * 0.97 && cupEnd > cupStart * 0.98) patterns.push('Cup and handle');
    const highRange = Math.max(...recent.map(candle => candle.h));
    const lowRange = Math.min(...recent.map(candle => candle.l));
    if ((highRange - lowRange) / Math.max(lowRange, 0.0001) < 0.04) patterns.push('Rectangle trading range');
  }
  return patterns;
}

function classifyChartPatterns(patterns) {
  const bullishNames = ['bottom', 'ascending', 'rising', 'bullish', 'inverse head', 'falling wedge', 'bull flag', 'bullish pennant', 'cup and handle'];
  const bearishNames = ['top', 'descending', 'falling', 'bearish', 'head and shoulders', 'rising wedge', 'bear flag', 'bearish pennant'];
  const bullish = [];
  const bearish = [];
  patterns.forEach((pattern) => {
    const normalized = pattern.toLowerCase();
    if (bullishNames.some(name => normalized.includes(name))) {
      bullish.push(pattern);
    } else if (bearishNames.some(name => normalized.includes(name))) {
      bearish.push(pattern);
    }
  });
  return { bullish, bearish };
}

// 1-MINUTE ONLY: Detect 8 specific breakout patterns with entry and stop levels
function detectOneMinuteBreakoutPatterns(candles, numCandles = TRADING_CONSTANTS.DEFAULT_CANDLES) {
  if (candles.length < TRADING_CONSTANTS.MIN_CANDLES_FOR_ONEMIN) return { bullish: [], bearish: [], breakoutLevels: {} };

  const recent = candles.slice(-numCandles);
  const highs = recent.filter((c, i) => i > 0 && i < recent.length - 1 && c.h >= recent[i - 1].h && c.h >= recent[i + 1].h);
  const lows = recent.filter((c, i) => i > 0 && i < recent.length - 1 && c.l <= recent[i - 1].l && c.l <= recent[i + 1].l);

  const bullish = [];
  const bearish = [];
  const breakoutLevels = {};

  // 1. DOUBLE BOTTOM: Two lows at similar level, breakout above middle peak
  if (lows.length >= 2) {
    const lastLow = lows.at(-1).l;
    const secondLastLow = lows.at(-2).l;
    if (Math.abs(lastLow - secondLastLow) / Math.max(lastLow, secondLastLow) < TRADING_CONSTANTS.DOUBLE_BOTTOM_TOLERANCE) {
      const peaksBetween = recent.filter(c => c.h > lastLow && c.h > secondLastLow);
      const centralPeak = Math.max(...peaksBetween.map(c => c.h));
      bullish.push('Double Bottom');
      breakoutLevels['Double Bottom'] = {
        entry: centralPeak, // Breakout above central peak
        stopLoss: Math.min(lastLow, secondLastLow), // Below second bottom
        type: 'BUY'
      };
    }
  }

  // 2. INVERSE HEAD & SHOULDERS: Trough, Higher trough, Lower trough, neckline
  if (lows.length >= 3) {
    const leftShoulder = lows.at(-3).l;
    const head = lows.at(-2).l;
    const rightShoulder = lows.at(-1).l;
    if (head < leftShoulder && head < rightShoulder) { // Head is lowest
      const neckline = Math.max(leftShoulder, rightShoulder); // Connect shoulder highs
      bullish.push('Inverse Head & Shoulders');
      breakoutLevels['Inverse Head & Shoulders'] = {
        entry: neckline, // Breakout above neckline
        stopLoss: rightShoulder, // Just below right shoulder
        type: 'BUY'
      };
    }
  }

  // 3. ASCENDING TRIANGLE: Rising lows, flat resistance
  if (lows.length >= 2) {
    const lastLow = lows.at(-1).l;
    const prevLow = lows.at(-2).l;
    if (lastLow > prevLow) { // Rising lows
      const resistance = Math.max(...recent.map(c => c.h));
      const resistanceTolerance = resistance * 0.005;
      const topBound = recent.filter(c => c.h >= resistance - resistanceTolerance);
      if (topBound.length >= 2) { // Flat resistance
        bullish.push('Ascending Triangle');
        breakoutLevels['Ascending Triangle'] = {
          entry: resistance, // Breakout above flat resistance
          stopLoss: prevLow, // Below ascending trendline (previous low)
          type: 'BUY'
        };
      }
    }
  }

  // 4. BULLISH FLAG: Pole up, consolidation below, breakout
  const first = recent[0].c;
  const mid = recent[Math.floor(recent.length / 2)].c;
  const last = recent.at(-1).c;
  if (mid > first && last > first) { // Uptrend exists
    const flagStart = Math.floor(recent.length / 2);
    const flagZone = recent.slice(flagStart);
    const flagHigh = Math.max(...flagZone.map(c => c.h));
    const flagLow = Math.min(...flagZone.map(c => c.l));
    const poleHigh = Math.max(...recent.slice(0, flagStart).map(c => c.h));
    if (flagHigh < poleHigh && flagLow > 0) { // Flag is consolidation
      bullish.push('Bullish Flag');
      breakoutLevels['Bullish Flag'] = {
        entry: flagHigh, // Breakout above flag channel high
        stopLoss: flagLow, // Inside flag's lowest bounds
        type: 'BUY'
      };
    }
  }

  // 5. HEAD & SHOULDERS: Peak, Higher peak, Lower peak, neckline
  if (highs.length >= 3) {
    const leftShoulder = highs.at(-3).h;
    const head = highs.at(-2).h;
    const rightShoulder = highs.at(-1).h;
    if (head > leftShoulder && head > rightShoulder) { // Head is highest
      const neckline = Math.min(leftShoulder, rightShoulder); // Connect shoulder lows
      bearish.push('Head & Shoulders');
      breakoutLevels['Head & Shoulders'] = {
        entry: neckline, // Breakout below neckline
        stopLoss: rightShoulder, // Above right shoulder
        type: 'SELL'
      };
    }
  }

  // 6. DOUBLE TOP: Two highs at similar level, breakout below middle valley
  if (highs.length >= 2) {
    const lastHigh = highs.at(-1).h;
    const secondLastHigh = highs.at(-2).h;
    if (Math.abs(lastHigh - secondLastHigh) / Math.max(lastHigh, secondLastHigh) < 0.005) { // Within 0.5%
      const valleysBetween = recent.filter(c => c.l < lastHigh && c.l < secondLastHigh);
      const centralValley = Math.min(...valleysBetween.map(c => c.l));
      bearish.push('Double Top');
      breakoutLevels['Double Top'] = {
        entry: centralValley, // Breakout below central valley
        stopLoss: Math.max(lastHigh, secondLastHigh), // Above second peak
        type: 'SELL'
      };
    }
  }

  // 7. BEARISH FLAG: Pole down, consolidation above, breakout
  if (mid < first && last < first) { // Downtrend exists
    const flagStart = Math.floor(recent.length / 2);
    const flagZone = recent.slice(flagStart);
    const flagHigh = Math.max(...flagZone.map(c => c.h));
    const flagLow = Math.min(...flagZone.map(c => c.l));
    const poleLow = Math.min(...recent.slice(0, flagStart).map(c => c.l));
    if (flagLow > poleLow && flagHigh > 0) { // Flag is consolidation
      bearish.push('Bearish Flag');
      breakoutLevels['Bearish Flag'] = {
        entry: flagLow, // Breakout below flag channel low
        stopLoss: flagHigh, // Inside flag's highest bounds
        type: 'SELL'
      };
    }
  }

  // 8. DESCENDING TRIANGLE: Falling highs, flat support
  if (highs.length >= 2) {
    const lastHigh = highs.at(-1).h;
    const prevHigh = highs.at(-2).h;
    if (lastHigh < prevHigh) { // Falling highs
      const support = Math.min(...recent.map(c => c.l));
      const supportTolerance = support * 0.005;
      const bottomBound = recent.filter(c => c.l <= support + supportTolerance);
      if (bottomBound.length >= 2) { // Flat support
        bearish.push('Descending Triangle');
        breakoutLevels['Descending Triangle'] = {
          entry: support, // Breakout below flat support
          stopLoss: prevHigh, // Above descending trendline (previous high)
          type: 'SELL'
        };
      }
    }
  }

  return { bullish, bearish, breakoutLevels };
}

// Detect high-probability 1-minute specific patterns for scalping/intraday
function detectOneMinutePatterns(candles) {
  if (candles.length < 10) return { bullish: [], bearish: [] };

  const recent = candles.slice(-15); // Last 15 candles for 1-minute analysis
  const bullish = [];
  const bearish = [];

  // 1. Consolidation Breakout (narrow range followed by break)
  const midpoint = Math.floor(recent.length / 2);
  const consolidationZone = recent.slice(0, midpoint);
  const breakoutZone = recent.slice(midpoint);
  const consolHigh = Math.max(...consolidationZone.map(c => c.h));
  const consolLow = Math.min(...consolidationZone.map(c => c.l));
  const consolRange = consolHigh - consolLow;
  const breakHigh = Math.max(...breakoutZone.map(c => c.h));
  const breakLow = Math.min(...breakoutZone.map(c => c.l));

  if (consolRange < Math.max(...recent.map(c => c.h - c.l)) * 0.8) {
    if (breakHigh > consolHigh) bullish.push('Consolidation breakout up');
    if (breakLow < consolLow) bearish.push('Consolidation breakout down');
  }

  // 2. Momentum Surge (series of candles moving in same direction with increasing body size)
  const last3 = recent.slice(-3);
  const last3Bodies = last3.map(c => Math.abs(c.c - c.o));
  const bullish3 = last3.every(c => c.c > c.o) && last3Bodies[1] > last3Bodies[0] && last3Bodies[2] > last3Bodies[1];
  const bearish3 = last3.every(c => c.c < c.o) && last3Bodies[1] > last3Bodies[0] && last3Bodies[2] > last3Bodies[1];

  if (bullish3) bullish.push('Momentum surge up');
  if (bearish3) bearish.push('Momentum surge down');

  // 3. Support/Resistance Bounce (rejected at level, bouncing back)
  const last5 = recent.slice(-5);
  const low5 = Math.min(...last5.map(c => c.l));
  const high5 = Math.max(...last5.map(c => c.h));
  const lastCandle = recent.at(-1);
  const secondLast = recent.at(-2);

  if (secondLast && lastCandle.l >= low5 && lastCandle.c > lastCandle.o && lastCandle.c > secondLast.c) {
    bullish.push('Support bounce');
  }
  if (secondLast && lastCandle.h <= high5 && lastCandle.c < lastCandle.o && lastCandle.c < secondLast.c) {
    bearish.push('Resistance rejection');
  }

  // 4. Higher Highs & Higher Lows (Uptrend) / Lower Highs & Lower Lows (Downtrend)
  if (recent.length >= 4) {
    const prev2 = recent.slice(-4, -2);
    const curr2 = recent.slice(-2);
    const prevHigh = Math.max(...prev2.map(c => c.h));
    const prevLow = Math.min(...prev2.map(c => c.l));
    const currHigh = Math.max(...curr2.map(c => c.h));
    const currLow = Math.min(...curr2.map(c => c.l));

    if (currHigh > prevHigh && currLow > prevLow) bullish.push('Higher highs and lows');
    if (currHigh < prevHigh && currLow < prevLow) bearish.push('Lower highs and lows');
  }

  // 5. Gap Continuation (gap in direction of trend)
  if (recent.length >= 2) {
    const prev = recent.at(-2);
    const curr = recent.at(-1);
    if (curr.o > prev.h && curr.c > curr.o) bullish.push('Gap continuation up');
    if (curr.o < prev.l && curr.c < curr.o) bearish.push('Gap continuation down');
  }

  return { bullish, bearish };
}

function getMarketConfirmations(candles) {
  const ema20 = calculateEma(candles, 20).at(-1)?.value || 0;
  const ema50 = calculateEma(candles, 50).at(-1)?.value || 0;
  const rsi = calculateRsi(candles, 14).at(-1)?.y;
  const latestClose = candles.at(-1)?.c || 0;
  const validRsi = Number.isFinite(rsi);
  return {
    ema20,
    ema50,
    rsi,
    bullish: ema20 > ema50 && latestClose > ema20 && validRsi && rsi >= 50 && rsi <= 70,
    bearish: ema20 < ema50 && latestClose < ema20 && validRsi && rsi >= 30 && rsi <= 50,
  };
}

function calculateInstitutionalTradeSignal(candles, numCandles = 40) {
  if (candles.length < TRADING_CONSTANTS.MIN_CANDLES_FOR_INSTITUTIONAL) {
    return { action: SIGNAL_ACTIONS.HOLD, pattern: 'Insufficient data', reason: 'Need at least 20 candles for 5-minute analysis' };
  }
  const recent = candles.slice(-numCandles);
  const chartPatterns = classifyChartPatterns(findChartPatterns(recent, false, numCandles));

  if (chartPatterns.bullish.length > 0) {
    return {
      action: SIGNAL_ACTIONS.BUY,
      pattern: `Chart Pattern: ${chartPatterns.bullish.join(', ')}`,
      reason: `Bullish chart patterns detected: ${chartPatterns.bullish.join(', ')}`,
    };
  }

  if (chartPatterns.bearish.length > 0) {
    return {
      action: SIGNAL_ACTIONS.SELL,
      pattern: `Chart Pattern: ${chartPatterns.bearish.join(', ')}`,
      reason: `Bearish chart patterns detected: ${chartPatterns.bearish.join(', ')}`,
    };
  }

  return {
    action: 'HOLD',
    pattern: 'No chart patterns detected',
    reason: 'Waiting for chart patterns',
  };
}

function calculateOneMinuteTradeSignal(candles, fiveMinuteCandles = [], threeMinuteCandles = [], numCandles = TRADING_CONSTANTS.DEFAULT_CANDLES) {
  // SIMPLE STRATEGY: VWAP + 10/20 EMA Crossover
  
  if (candles.length < 25) {
    return {
      action: SIGNAL_ACTIONS.HOLD,
      pattern: 'Insufficient data',
      reason: 'Need at least 25 candles for EMA calculation',
    };
  }

  // Calculate EMAs
  const ema10 = calculateEma(candles, 10);
  const ema20 = calculateEma(candles, 20);
  
  // Get latest values
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  
  const currentEma10 = ema10[ema10.length - 1]?.value || 0;
  const currentEma20 = ema20[ema20.length - 1]?.value || 0;
  const prevEma10 = ema10[ema10.length - 2]?.value || 0;
  const prevEma20 = ema20[ema20.length - 2]?.value || 0;
  
  const currentPrice = lastCandle.c;
  
  // Calculate VWAP
  const vwap = calculateVwap(candles);
  const lastVwap = vwap[vwap.length - 1]?.value || 0;
  
  // Check EMA crossover
  const bullishCross = prevEma10 <= prevEma20 && currentEma10 > currentEma20;
  const bearishCross = prevEma10 >= prevEma20 && currentEma10 < currentEma20;
  
  // Check VWAP alignment
  const priceAboveVwap = currentPrice > lastVwap;
  const priceBelowVwap = currentPrice < lastVwap;
  
  // BUY Signal: EMA10 crosses above EMA20 AND price is above VWAP
  if (bullishCross && priceAboveVwap) {
    console.log(`[EMA-VWAP] 🟢 BUY Signal: EMA10 ${currentEma10.toFixed(2)} > EMA20 ${currentEma20.toFixed(2)}, Price ${currentPrice.toFixed(2)} > VWAP ${lastVwap.toFixed(2)}`);
    
    const recent = candles.slice(-20);
    const recentLow = Math.min(...recent.map(c => c.l));
    const risk = currentPrice - recentLow;
    
    return {
      action: SIGNAL_ACTIONS.BUY,
      pattern: 'EMA 10/20 Crossover + VWAP',
      reason: `EMA10 crossed above EMA20 at ${currentEma10.toFixed(2)} with price above VWAP ${lastVwap.toFixed(2)}`,
      isOneMinuteTrade: true,
      chartPatterns: ['EMA Crossover'],
      breakoutLevels: {
        entry: currentPrice,
        stopLoss: recentLow,
        type: 'EMA Crossover',
      },
    };
  }
  
  // SELL Signal: EMA10 crosses below EMA20 AND price is below VWAP
  if (bearishCross && priceBelowVwap) {
    console.log(`[EMA-VWAP] 🔴 SELL Signal: EMA10 ${currentEma10.toFixed(2)} < EMA20 ${currentEma20.toFixed(2)}, Price ${currentPrice.toFixed(2)} < VWAP ${lastVwap.toFixed(2)}`);
    
    const recent = candles.slice(-20);
    const recentHigh = Math.max(...recent.map(c => c.h));
    const risk = recentHigh - currentPrice;
    
    return {
      action: SIGNAL_ACTIONS.SELL,
      pattern: 'EMA 10/20 Crossover + VWAP',
      reason: `EMA10 crossed below EMA20 at ${currentEma10.toFixed(2)} with price below VWAP ${lastVwap.toFixed(2)}`,
      isOneMinuteTrade: true,
      chartPatterns: ['EMA Crossover'],
      breakoutLevels: {
        entry: currentPrice,
        stopLoss: recentHigh,
        type: 'EMA Crossover',
      },
    };
  }
  
  return {
    action: 'HOLD',
    pattern: 'EMA 10/20 Crossover + VWAP',
    reason: `Waiting for EMA crossover. Current EMA10: ${currentEma10.toFixed(2)}, EMA20: ${currentEma20.toFixed(2)}, VWAP: ${lastVwap.toFixed(2)}`,
    isOneMinuteTrade: true,
  };
}

function isBeforeThreePmIst(timestamp) {
  const indiaTime = new Date(new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return indiaTime.getHours() * 60 + indiaTime.getMinutes() < TRADING_CONSTANTS.TRADING_CLOSE_HOUR * 60 + TRADING_CONSTANTS.TRADING_CLOSE_MINUTE;
}

function calculateTradeSignal(candles, oneMinuteMode = false, fiveMinuteCandles = [], threeMinuteCandles = [], numCandles = TRADING_CONSTANTS.DEFAULT_CANDLES) {
  const signal = oneMinuteMode ? calculateOneMinuteTradeSignal(candles, fiveMinuteCandles, threeMinuteCandles, numCandles) : calculateInstitutionalTradeSignal(candles, numCandles);
  if ([SIGNAL_ACTIONS.BUY, SIGNAL_ACTIONS.SELL].includes(signal.action) && !isBeforeThreePmIst(candles.at(-1)?.x)) {
    return {
      action: SIGNAL_ACTIONS.HOLD,
      pattern: 'New entries disabled after 3:00 PM IST',
      reason: 'No new BUY or SELL signal is allowed after 3:00 PM IST. Existing positions must close using their target, stop loss, or intraday square-off.',
    };
  }
  return signal;
}

function calculateTradeLevels(candles, signal, oneMinuteMode = false, numCandles = TRADING_CONSTANTS.DEFAULT_CANDLES) {
  const signalCandle = candles.at(-1);
  const entry = signalCandle.c;

  if (!oneMinuteMode) {
    const recent = candles.slice(-20);
    const recentLow = Math.min(...recent.map(candle => candle.l));
    const recentHigh = Math.max(...recent.map(candle => candle.h));
    const averageRange = recent.reduce((sum, candle) => sum + (candle.h - candle.l), 0) / recent.length;
    const fallbackRisk = Math.max(averageRange * 1.2, 0.5);
    return signal.action === 'BUY'
      ? { entry, target: Math.max(recentHigh, entry + fallbackRisk * 2), stopLoss: recentLow - fallbackRisk }
      : { entry, target: Math.min(recentLow, entry - fallbackRisk * 2), stopLoss: recentHigh + fallbackRisk };
  }

  // 1-MINUTE: USE PATTERN-BASED BREAKOUT LEVELS
  if (signal.breakoutLevels) {
    const { entry: patternEntry, stopLoss: patternStop, type } = signal.breakoutLevels;

    if (signal.action === 'BUY') {
      const risk = patternEntry - patternStop;
      // Target: 2x risk from entry (institutional 1:2 ratio)
      const target = patternEntry + (risk * 2);
      return {
        entry: patternEntry, // Pattern breakout level
        target,
        stopLoss: patternStop, // Pattern stop level
        risk,
        rewardRatio: 2,
        levelSource: `Breakout Pattern: ${signal.chartPatterns[0]}`,
      };
    } else {
      // SELL
      const risk = patternStop - patternEntry;
      const target = patternEntry - (risk * 2);
      return {
        entry: patternEntry,
        target: Math.max(target, 0.05), // Ensure positive target
        stopLoss: patternStop,
        risk,
        rewardRatio: 2,
        levelSource: `Breakout Pattern: ${signal.chartPatterns[0]}`,
      };
    }
  }

  // Fallback: Window-based levels (should not reach here for 1-min with breakout patterns)
  const window = candles.slice(-numCandles);
  const windowHigh = Math.max(...window.map(c => c.h));
  const windowLow = Math.min(...window.map(c => c.l));

  if (signal.action === 'BUY') {
    const stopLoss = windowLow;
    const target = windowHigh;
    const risk = entry - stopLoss;

    return {
      entry,
      target,
      stopLoss,
      risk,
      rewardRatio: risk > 0 ? (target - entry) / risk : 0,
      levelSource: 'Chart Pattern: BUY stop at pattern low, target at pattern high',
    };
  } else {
    // SELL
    const stopLoss = windowHigh;
    const target = windowLow;
    const risk = stopLoss - entry;

    return {
      entry,
      target,
      stopLoss,
      risk,
      rewardRatio: risk > 0 ? (entry - target) / risk : 0,
      levelSource: 'Chart Pattern: SELL stop at pattern high, target at pattern low',
    };
  }
}

function calculateCurrentTradePlan(candles, signal) {
  if (!signal || !['BUY', 'SELL'].includes(signal.action) || candles.length === 0) return null;
  return { ...signal, time: candles.at(-1).x, ...calculateTradeLevels(candles, signal, signal.isOneMinuteTrade) };
}

function evaluateSignalWithFutureCandles(signal, future, target, stopLoss, sessionCloseCandle = null) {
  if (future.length === 0) {
    if (sessionCloseCandle) {
      return {
        outcome: 'Session Exit',
        exitPrice: sessionCloseCandle.c,
        closedAt: sessionCloseCandle.x,
        evaluation: `Same-day session exit at ₹${sessionCloseCandle.c.toFixed(2)}; position was not carried overnight`,
      };
    }
    return { outcome: 'Pending', evaluation: 'Waiting for the next candle high/low' };
  }

  for (const [futureIndex, candle] of future.entries()) {
    const hitStop = signal.action === 'BUY' ? candle.l <= stopLoss : candle.h >= stopLoss;
    const hitTarget = signal.action === 'BUY' ? candle.h >= target : candle.l <= target;
    const triggerTime = new Date(candle.x).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (hitStop && hitTarget) {
      return {
        outcome: 'Ambiguous',
        evaluation: `${triggerTime}: high/low touched both target and stop`,
        candlesToOutcome: futureIndex + 1,
        closedAt: candle.x,
      };
    }
    if (hitTarget) {
      const triggerPrice = signal.action === 'BUY' ? candle.h : candle.l;
      return {
        outcome: 'True',
        evaluation: `${triggerTime}: ${signal.action === 'BUY' ? 'high' : 'low'} ₹${triggerPrice.toFixed(2)} reached target`,
        candlesToOutcome: futureIndex + 1,
        closedAt: candle.x,
      };
    }
    if (hitStop) {
      const triggerPrice = signal.action === 'BUY' ? candle.l : candle.h;
      const adverseMove = Math.abs(triggerPrice - stopLoss);
      return {
        outcome: 'False',
        evaluation: `${triggerTime}: ${signal.action === 'BUY' ? 'low' : 'high'} ₹${triggerPrice.toFixed(2)} hit stop ₹${stopLoss.toFixed(2)} (₹${adverseMove.toFixed(2)} beyond stop)`,
        candlesToOutcome: futureIndex + 1,
        closedAt: candle.x,
      };
    }
  }
  if (sessionCloseCandle) {
    return {
      outcome: 'Session Exit',
      exitPrice: sessionCloseCandle.c,
      closedAt: sessionCloseCandle.x,
      evaluation: `Same-day session exit at ₹${sessionCloseCandle.c.toFixed(2)}; position was not carried overnight`,
    };
  }
  return {
    outcome: 'Pending',
    evaluation: `Checked ${future.length} future candle${future.length === 1 ? '' : 's'}; target/stop not touched yet`,
  };
}

function getTradingDayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getStrategyReview(signalRows) {
  const completed = signalRows.filter(signal => signal.outcome === 'True' || signal.outcome === 'False');
  const failed = completed.filter(signal => signal.outcome === 'False');
  if (failed.length === 0) return [];

  const failedOnFirstFutureCandle = failed.filter(signal => signal.candlesToOutcome === 1).length;
  const failureRate = (failed.length / completed.length) * 100;
  const review = [`${failed.length} of ${completed.length} completed signals stopped out (${failureRate.toFixed(1)}%).`];
  if (failedOnFirstFutureCandle > 0) {
    review.push(`${failedOnFirstFutureCandle} losses hit the stop on the first next candle; test a confirmation entry after the signal candle.`);
  }
  review.push('Test results by timeframe and market regime, then compare an ATR-based stop with the current recent-range stop before changing live rules.');
  return review;
}

function calculateTradeCost(entry, lotSize) {
  const quantity = Number(lotSize) || 1;
  const notional = Number(entry) * quantity;
  const brokerage = notional * 0.0003;
  const exchange = notional * 0.0005;
  const gst = (brokerage + exchange) * 0.18;
  const stt = notional * 0.0001;
  const stamp = notional * 0.00003;
  const totalCharges = brokerage + exchange + gst + stt + stamp;

  return {
    notional,
    totalCharges,
    totalCashRequired: notional + totalCharges,
  };
}

function buildSignalRows(candles, oneMinuteMode = false, fiveMinuteCandles = [], threeMinuteCandles = [], numCandles = TRADING_CONSTANTS.DEFAULT_CANDLES) {
  let activeTradeUntil = 0;
  console.log('buildSignalRows time', new Date())
  console.log('buildSignalRows', candles?.length)
  return candles
    .map((_, index) => {
      if (index < 10) return null;
      if (candles[index].x <= activeTradeUntil) return null;
      if (!isBeforeThreePmIst(candles[index].x)) return null;
      const window = candles.slice(0, index + 1).slice(-numCandles);
      const fiveMinuteWindow = fiveMinuteCandles.filter(candle => candle.x <= candles[index].x).slice(-numCandles);
      const threeMinuteWindow = threeMinuteCandles.filter(candle => candle.x <= candles[index].x).slice(-numCandles);
      const signal = calculateTradeSignal(window, oneMinuteMode, fiveMinuteWindow, threeMinuteWindow, numCandles);
      if (signal.action === 'HOLD') return null;

      const signalCandle = candles[index];
      const levels = calculateTradeLevels(window, signal, oneMinuteMode, numCandles);
      const { entry, target, stopLoss } = levels;

      if (signal.action === 'BUY') {
        const allFutureCandles = candles.slice(index + 1);
        const future = oneMinuteMode
          ? allFutureCandles.filter(candle => getTradingDayKey(candle.x) === getTradingDayKey(signalCandle.x))
          : allFutureCandles;
        const sessionEnded = oneMinuteMode && allFutureCandles.some(candle => getTradingDayKey(candle.x) !== getTradingDayKey(signalCandle.x));
        const result = evaluateSignalWithFutureCandles(signal, future, target, stopLoss, sessionEnded ? future.at(-1) || signalCandle : null);
        activeTradeUntil = result.closedAt || Number.MAX_SAFE_INTEGER;
        return {
          ...signal,
          time: signalCandle.x,
          entry,
          target,
          stopLoss,
          levelSource: levels.levelSource,
          ...result,
        };
      }

      const allFutureCandles = candles.slice(index + 1);
      const future = oneMinuteMode
        ? allFutureCandles.filter(candle => getTradingDayKey(candle.x) === getTradingDayKey(signalCandle.x))
        : allFutureCandles;
      const sessionEnded = oneMinuteMode && allFutureCandles.some(candle => getTradingDayKey(candle.x) !== getTradingDayKey(signalCandle.x));
      const result = evaluateSignalWithFutureCandles(signal, future, target, stopLoss, sessionEnded ? future.at(-1) || signalCandle : null);
      activeTradeUntil = result.closedAt || Number.MAX_SAFE_INTEGER;
      return {
        ...signal,
        time: signalCandle.x,
        entry,
        target,
        stopLoss,
        levelSource: levels.levelSource,
        ...result,
      };
    })
    .filter(Boolean)
    .reverse();
}

function buildReverseSignalRows(signalRows) {
  // Create reverse signals: if original is BUY, reverse is SELL (and vice versa)
  // Reverse signal exits when original signal's target or stop loss is hit
  return signalRows.map(signal => {
    const reverseAction = signal.action === 'BUY' ? 'SELL' : 'BUY';

    // For reverse signal:
    // Entry = original entry (where we reverse trade starts)
    // Target = original stopLoss (profit target of reverse = where original stops out)
    // StopLoss = original target (loss point of reverse = where original takes profit)
    const reverseEntry = signal.entry;
    const reverseTarget = signal.stopLoss;
    const reverseStopLoss = signal.target;

    // Determine outcome based on original signal's outcome
    // If original hit target (profit), reverse hits stopLoss (loss)
    // If original hit stopLoss (loss), reverse hits target (profit)
    let reverseOutcome = signal.outcome; // Pending initially
    if (signal.outcome === 'True') {
      // Original won, so reverse loses (original target = reverse stopLoss)
      reverseOutcome = 'False';
    } else if (signal.outcome === 'False') {
      // Original lost, so reverse wins (original stopLoss = reverse target)
      reverseOutcome = 'True';
    }

    return {
      ...signal,
      action: reverseAction,
      entry: reverseEntry,
      target: reverseTarget,
      stopLoss: reverseStopLoss,
      outcome: reverseOutcome,
      reason: `Reverse of: ${signal.reason}`,
      isReverse: true,
    };
  });
}

// Helper function to generate EMA strategy signals (loss-making strategy - trades against EMA)
function buildEmaStrategyRows(signalRows, emaData) {
  // EMA strategy: contrarian signals that trade against EMA direction
  // This is typically a loss-making strategy used to identify when NOT to trade
  return signalRows.map(signal => {
    const emaValue = emaData?.ema20 || 0;
    const closePrice = signal.entry || 0;
    
    // Invert the original signal
    const emaAction = signal.action === 'BUY' ? 'SELL' : 'BUY';
    
    // EMA Strategy levels (opposite of main strategy)
    // Entry: slightly worse than main entry
    const emaEntry = signal.action === 'BUY' 
      ? signal.entry + (signal.entry * 0.002)  // 0.2% worse for SELL
      : signal.entry - (signal.entry * 0.002); // 0.2% worse for BUY
    
    // Target: half the distance of main strategy target
    const emaTarget = signal.action === 'BUY'
      ? signal.stopLoss - ((signal.entry - signal.stopLoss) * 0.5)
      : signal.stopLoss + ((signal.stopLoss - signal.entry) * 0.5);
    
    // StopLoss: at main strategy target (high risk)
    const emaStopLoss = signal.target;
    
    // EMA Strategy usually loses money (inverted outcome)
    let emaOutcome = 'Pending';
    let emaEvaluation = signal.evaluation; // Start with original evaluation
    
    if (signal.outcome === 'True') {
      emaOutcome = 'False'; // Original won, EMA loses (hits stop loss which is at original target)
      // Adapt evaluation: when original hit target, EMA hit stop loss at that same price
      if (signal.evaluation.includes('reached target')) {
        const originalPrice = signal.target;
        emaEvaluation = signal.evaluation
          .replace('reached target', `hit stop ₹${emaStopLoss.toFixed(2)}`)
          .replace(/high|low/, emaAction === 'SELL' ? 'low' : 'high');
      }
    } else if (signal.outcome === 'False') {
      emaOutcome = 'True';  // Original lost, EMA wins (rare) (hits target which is at original stop loss)
      // Adapt evaluation: when original hit stop loss, EMA hit target at that same price
      if (signal.evaluation.includes('hit stop')) {
        const originalPrice = signal.stopLoss;
        emaEvaluation = signal.evaluation
          .replace(/hit stop.*/, `reached target ₹${emaTarget.toFixed(2)}`)
          .replace(/high|low/, emaAction === 'SELL' ? 'low' : 'high');
      }
    }

    return {
      ...signal,
      action: emaAction,
      entry: emaEntry,
      target: emaTarget,
      stopLoss: emaStopLoss,
      outcome: emaOutcome,
      reason: `EMA Contrarian: Against ${signal.reason}`,
      isEmaStrategy: true,
      evaluation: emaEvaluation,
    };
  });
}

// Helper function to update signal exit details
function updateSignalExit(signal, exitPrice, outcome) {
  return {
    ...signal,
    exitPrice: exitPrice,
    outcome: outcome, // 'True' if hit target, 'False' if hit SL, 'Pending' if still open
    evaluation: outcome === 'Pending' ? 'Awaiting outcome' : outcome === 'True' ? 'Profit' : 'Loss',
  };
}

function PCRAnalysis({ apiKey }) {
  const [pcrData, setPcrData] = useState(null);
  const [nifty50Data, setNifty50Data] = useState(null);
  const [strikeOptions, setStrikeOptions] = useState([]);
  const [selectedInstrument, setSelectedInstrument] = useState('NIFTY');
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState('minute');
  const [livePrice, setLivePrice] = useState(null);
  const [candleData, setCandleData] = useState([]);
  const [ema10Data, setEma10Data] = useState([]);
  const [ema20Data, setEma20Data] = useState([]);
  const [closeChartData, setCloseChartData] = useState(null);
  const [rsiChartData, setRsiChartData] = useState(null);
  const [tradeSignal, setTradeSignal] = useState({ action: 'HOLD', pattern: 'Waiting for data', reason: '' });
  const [autoTradePlan, setAutoTradePlan] = useState(null);
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
  const [autoTradingAcknowledged, setAutoTradingAcknowledged] = useState(false);
  const [autoTradingStatus, setAutoTradingStatus] = useState('Automatic trading is off.');
  const [autoTradingBusy, setAutoTradingBusy] = useState(false);
  const [submittedAutoSignalKey, setSubmittedAutoSignalKey] = useState('');
  const [signalRows, setSignalRows] = useState([]);
  const [reverseSignalRows, setReverseSignalRows] = useState([]);
  const [emaStrategyRows, setEmaStrategyRows] = useState([]);
  const [signalFilter, setSignalFilter] = useState('ALL');
  const [dayFilter, setDayFilter] = useState(new Date().toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })); // Default to current day
  const [fiveMinuteCandleData, setFiveMinuteCandleData] = useState([]);
  const [threeMinuteCandleData, setThreeMinuteCandleData] = useState([]);
  const [lockedSignalKeys, setLockedSignalKeys] = useState(new Set()); // Track signals that are locked (submitted/in progress)
  const [numCandles, setNumCandles] = useState(TRADING_CONSTANTS.DEFAULT_CANDLES); // Configurable number of candles for pattern detection
  const [tickCounter, setTickCounter] = useState(0); // Incremented on every tick to trigger signal updates
  const candleChartRef = React.useRef(null);
  const chartSeriesRef = React.useRef(null);
  const ema10SeriesRef = React.useRef(null);
  const ema20SeriesRef = React.useRef(null);
  const candleDataRef = React.useRef([]);
  const lastUpdateTimeRef = React.useRef(0);
  const lastCandleOpenRef = React.useRef(null);
  const currentCandleBoundaryRef = React.useRef(null);
  const currentCandleDataRef = React.useRef({ time: null, open: null, high: null, low: null, close: null });
  const previousCandleLengthRef = React.useRef(0);
  const livePriceRef = React.useRef(null);
  const lastPolledLengthRef = React.useRef(0);
  const [latestCandle, setLatestCandle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);
  const [kiteSessionError, setKiteSessionError] = useState(null);
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  // Helper function to check if current time is within market hours (9:15 AM to 3:40 PM IST)
  const checkMarketHours = () => {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const dayOfWeek = istTime.getDay();
    
    // Market closed on weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Market hours: 9:15 AM to 3:40 PM IST
    const isOpen = (hours > TRADING_CONSTANTS.MARKET_OPEN_HOUR || (hours === TRADING_CONSTANTS.MARKET_OPEN_HOUR && minutes >= TRADING_CONSTANTS.MARKET_OPEN_MINUTE)) 
      && (hours < TRADING_CONSTANTS.MARKET_CLOSE_HOUR || (hours === TRADING_CONSTANTS.MARKET_CLOSE_HOUR && minutes <= TRADING_CONSTANTS.MARKET_CLOSE_MINUTE));
    return isOpen;
  };

  // Monitor market hours status
  useEffect(() => {
    const updateMarketStatus = () => {
      setIsMarketOpen(checkMarketHours());
    };
    
    updateMarketStatus();
    const marketCheckInterval = setInterval(updateMarketStatus, TRADING_CONSTANTS.MARKET_CHECK_INTERVAL);
    
    return () => clearInterval(marketCheckInterval);
  }, []);

  // Method to lock a signal (freeze entry details)
  const getSignalKey = (signal) => `${signal.time}-${signal.action}`;

  const lockSignal = (signal) => {
    const signalKey = getSignalKey(signal);
    setLockedSignalKeys(prev => new Set([...prev, signalKey]));
    console.log(`[Signal Locked] ${signalKey} - Entry: ₹${signal.entry.toFixed(2)}, Target: ₹${signal.target.toFixed(2)}, SL: ₹${signal.stopLoss.toFixed(2)}`);
  };

  // Method to update signal exit details
  const updateSignalExitDetails = (signal, exitPrice, outcome) => {
    setSignalRows(prevRows =>
      prevRows.map(s =>
        s.time === signal.time && s.action === signal.action
          ? updateSignalExit(s, exitPrice, outcome)
          : s
      )
    );
    console.log(`[Signal Updated] ${signal.action} - Exit Price: ₹${exitPrice.toFixed(2)}, Outcome: ${outcome}`);
  };

  useEffect(() => {
    fetchPCRData();
  }, [apiKey]);

  useEffect(() => {
    if (!selectedStrike || !selectedInterval) return;
    // Load historical data once on strike/interval change
    fetchHistoricalChart(selectedStrike, selectedInterval);
    // Note: Real-time signals now use live ticks only (no periodic refresh)
    // This eliminates 15s+ latency and allows true real-time 1-minute trading
  }, [selectedStrike, selectedInterval]);

  useEffect(() => {
    if (!selectedStrike?.instrumentToken) {
    //  console.log('[LiveTicks] No instrument token selected');
      return undefined;
    }

    // Check if market is open
    if (!checkMarketHours()) {
   //   console.log('[LiveTicks] Market is closed (9:15 AM - 3:40 PM IST on weekdays only)');
      setKiteSessionError('Market is closed. Live data available 9:15 AM - 3:40 PM IST on weekdays only.');
      return undefined;
    }

    console.log(`[LiveTicks] Connecting to live-ticks for token: ${selectedStrike.instrumentToken} (${selectedStrike.tradingSymbol})`);

    let reconnectTimeout = null;
    const streamRef = { current: null };

    const connectStream = () => {
      streamRef.current = new EventSource(`/api/kite/live-ticks?instrument_token=${selectedStrike.instrumentToken}`, { withCredentials: true });

      streamRef.current.onopen = () => console.log(`[LiveTicks] EventSource connected for ${selectedStrike.instrumentToken}`);

      streamRef.current.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data);
        //  console.log(`[LiveTicks] Received update for ${selectedStrike.instrumentToken}: ₹${tick.lastPrice.toFixed(2)}`);
          streamRef.current.__lastMessageTime = Date.now();
          setLivePrice(tick.lastPrice);
        } catch (err) {
          console.error('[LiveTicks] Failed to parse message:', err, event.data);
        }
      };

      streamRef.current.onerror = (err) => {
        console.error(`[LiveTicks] EventSource error for ${selectedStrike.instrumentToken}:`, err);
        streamRef.current.close();
        streamRef.current = null;
        setKiteSessionError('Live ticks disconnected. Reconnecting...');

        // Exponential backoff reconnect: 3s, 6s, 12s, 24s, 48s (capped)
        const reconnectAttempts = (reconnectTimeout?.__attempts || 0) + 1;
        const backoffMs = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 60000);
        console.log(`[LiveTicks] Reconnect attempt ${reconnectAttempts} in ${backoffMs}ms`);

        reconnectTimeout = setTimeout(() => {
          setKiteSessionError(null);
          connectStream();
        }, backoffMs);
        reconnectTimeout.__attempts = reconnectAttempts;
      };
    };

    connectStream();

    // Heartbeat: detect stale connection
    const heartbeatTimeout = setInterval(() => {
      if (streamRef.current && streamRef.current.readyState === EventSource.OPEN) {
        // No message in 45 seconds = stale, reconnect
        const lastMessageTime = streamRef.current.__lastMessageTime || Date.now();
        if (Date.now() - lastMessageTime > 45000) {
          console.warn('[LiveTicks] No data for 45s, reconnecting...');
          streamRef.current.close();
          streamRef.current = null;
          setKiteSessionError('No live data received. Reconnecting...');
          reconnectTimeout = setTimeout(() => {
            setKiteSessionError(null);
            connectStream();
          }, 3000);
        }
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatTimeout);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (streamRef.current) {
        console.log(`[LiveTicks] Closing stream for ${selectedStrike.instrumentToken}`);
        streamRef.current.close();
      }
    };
  }, [selectedStrike, isMarketOpen]);

  useEffect(() => {
    if (!livePrice || !chartSeriesRef.current || candleData.length === 0) return;

    const getIntervalSeconds = (interval) => {
      return TRADING_CONSTANTS.TIMEFRAME_SECONDS[interval] || 60;
    };

    const getCandleBoundary = (timestamp, intervalSeconds) => {
      return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
    };

    const lastCandleData = candleData[candleData.length - 1];
    if (!lastCandleData) return;

    const lastCandleTime = Math.floor(lastCandleData.x / 1000);
    const currentTime = Math.floor(Date.now() / 1000);
    const intervalSeconds = getIntervalSeconds(selectedInterval);
    const currentCandleBoundary = getCandleBoundary(currentTime, intervalSeconds);

    try {
      if (currentCandleBoundary > currentCandleBoundaryRef.current) {
        // New candle period - finalize previous candle first, then create new one
        if (currentCandleDataRef.current.time !== null) {
          // Finalize the previous candle with its last known OHLC
          chartSeriesRef.current.update(currentCandleDataRef.current);
          console.log(`[Chart] Finalized previous candle: O=${currentCandleDataRef.current.open.toFixed(2)} H=${currentCandleDataRef.current.high.toFixed(2)} L=${currentCandleDataRef.current.low.toFixed(2)} C=${currentCandleDataRef.current.close.toFixed(2)}`);
        }

        // Create new candle
        lastCandleOpenRef.current = livePrice;
        currentCandleBoundaryRef.current = currentCandleBoundary;
        currentCandleDataRef.current = {
          time: Math.floor(currentCandleBoundary), // Time in seconds for Lightweight Charts
          open: livePrice,
          high: livePrice,
          low: livePrice,
          close: livePrice,
        };

        chartSeriesRef.current.update(currentCandleDataRef.current);
        console.log(`[Chart] New candle created at ${new Date(currentCandleBoundary * 1000).toISOString()}: O=${livePrice.toFixed(2)}`);
        
        // Update candleData state to trigger signal recalculation
        setCandleData(prevData => [...prevData, {
          x: currentCandleBoundary * 1000,
          o: livePrice,
          h: livePrice,
          l: livePrice,
          c: livePrice,
        }]);
      } else {
        // Same candle period - update current candle tracking
        const candleOpen = lastCandleOpenRef.current ?? lastCandleData.o;
        currentCandleDataRef.current = {
          time: Math.floor((currentCandleBoundaryRef.current ?? lastCandleTime)), // Ensure seconds format
          open: candleOpen,
          high: Math.max(currentCandleDataRef.current.high || lastCandleData.h, livePrice),
          low: Math.min(currentCandleDataRef.current.low || lastCandleData.l, livePrice),
          close: livePrice,
        };

        chartSeriesRef.current.update(currentCandleDataRef.current);
     //   console.log(`[Chart] Updated candle: O=${currentCandleDataRef.current.open.toFixed(2)} H=${currentCandleDataRef.current.high.toFixed(2)} L=${currentCandleDataRef.current.low.toFixed(2)} C=${currentCandleDataRef.current.close.toFixed(2)}`);

        // Increment tick counter to trigger signal recalculation on every tick
        setTickCounter(prev => prev + 1);

        // Update EMAs with just the latest point (more efficient for Lightweight Charts)
        if (ema10SeriesRef.current || ema20SeriesRef.current) {
          const updatedCandleData = candleData.map((candle, idx) => {
            if (idx === candleData.length - 1) {
              return {
                ...candle,
                h: Math.max(candle.h, livePrice),
                l: Math.min(candle.l, livePrice),
                c: livePrice,
              };
            }
            return candle;
          });

          // Calculate just the latest EMA values
          const multiplier10 = 2 / (10 + 1);
          const multiplier20 = 2 / (20 + 1);

          let ema10Value = updatedCandleData[0]?.c || 0;
          let ema20Value = updatedCandleData[0]?.c || 0;

          for (let i = 1; i < updatedCandleData.length; i++) {
            ema10Value = ((updatedCandleData[i].c - ema10Value) * multiplier10) + ema10Value;
            ema20Value = ((updatedCandleData[i].c - ema20Value) * multiplier20) + ema20Value;
          }

          const lastCandle = updatedCandleData[updatedCandleData.length - 1];
          const ema10Point = { time: Math.floor(lastCandle.x / 1000), value: ema10Value };
          const ema20Point = { time: Math.floor(lastCandle.x / 1000), value: ema20Value };

          if (ema10SeriesRef.current) {
            ema10SeriesRef.current.update(ema10Point);
          }
          if (ema20SeriesRef.current) {
            ema20SeriesRef.current.update(ema20Point);
          }

      //    console.log(`[EMA] Update - EMA10: ${ema10Value.toFixed(2)}, EMA20: ${ema20Value.toFixed(2)}`);
        }
      }
    } catch (err) {
      console.error('[Chart] Failed to update candle:', err.message);
    }
  }, [livePrice, candleData, selectedInterval]);

  // Real-time signal updates - only triggered when candleData changes (new candle closes)
  // Uses candleData.length to detect new candles, avoiding re-renders on every live price tick
  // Optimization: removed livePrice & tickCounter from dependencies to prevent 60+ calls/min
  useEffect(() => {
    if (candleData.length === 0 || !selectedStrike || !selectedInterval) return;

    const getIntervalSeconds = (interval) => {
      return TRADING_CONSTANTS.TIMEFRAME_SECONDS[interval] || 60;
    };

    const getCandleBoundary = (timestamp, intervalSeconds) => {
      return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
    };

    try {
      const intervalSeconds = getIntervalSeconds(selectedInterval);
      const currentTime = Math.floor(Date.now() / 1000);
      const currentCandleBoundary = getCandleBoundary(currentTime, intervalSeconds);
      const lastCandleData = candleData[candleData.length - 1];

      if (!lastCandleData) return;

      const lastCandleTime = Math.floor(lastCandleData.x / 1000);

      // Create updated candle data with live price incorporated into the last candle
      const updatedCandleData = candleData.map((candle, idx) => {
        if (idx === candleData.length - 1) {
          return {
            ...candle,
            h: Math.max(candle.h, livePriceRef.current || candle.h),
            l: Math.min(candle.l, livePriceRef.current || candle.l),
            c: livePriceRef.current || candle.c,
          };
        }
        return candle;
      });

      // 🔑 OPTIMIZATION: Only call buildSignalRows when candleData length changes (new candle)
      console.log(`[Signals-Effect] Triggered • candleData.length: ${candleData.length}, previousRef: ${previousCandleLengthRef.current}`);
      const isNewCandle = candleData.length > previousCandleLengthRef.current;
      const oneMinuteMode = selectedInterval === 'minute';
      
      if (isNewCandle) {
        // 🎉 NEW CANDLE - Full signal regeneration
        console.log(`[Signals] ✅ NEW CANDLE DETECTED! Calling buildSignalRows with length: ${candleData.length}`);
        previousCandleLengthRef.current = candleData.length;
        
        const currentSignal = calculateTradeSignal(updatedCandleData, oneMinuteMode, fiveMinuteCandleData, threeMinuteCandleData, numCandles);
        setTradeSignal(currentSignal);
        setAutoTradePlan(calculateCurrentTradePlan(updatedCandleData, currentSignal));
        const newSignalRows = buildSignalRows(updatedCandleData, oneMinuteMode, fiveMinuteCandleData, threeMinuteCandleData, numCandles);

        // Preserve locked signals and merge old and new signals
        let signalRowsWithCurrent = signalRows.map(signal => {
          const signalKey = getSignalKey(signal);
          const newSignalData = newSignalRows.find(r => r.time === signal.time && r.action === signal.action);
          // Preserve outcome if already locked (True/False), otherwise update with new data
          if (signal.outcome === 'True' || signal.outcome === 'False') {
            return signal; // Keep locked outcome
          }
          return lockedSignalKeys.has(signalKey) ? signal : newSignalData || signal;
        });
        
        // Add NEW signals from buildSignalRows that weren't in the old list
        for (const newSignal of newSignalRows) {
          const exists = signalRowsWithCurrent.some(s => s.time === newSignal.time && s.action === newSignal.action);
          if (!exists) {
            signalRowsWithCurrent.unshift(newSignal);
          }
        }

        // Add current live signal to the top of the table if it's not a HOLD and not already locked
        if (currentSignal.action !== 'HOLD') {
          const lastCandle = updatedCandleData[updatedCandleData.length - 1];
          const currentSignalKey = getSignalKey({ time: lastCandle.x, action: currentSignal.action });

          if (!lockedSignalKeys.has(currentSignalKey)) {
            const levels = calculateTradeLevels(updatedCandleData.slice(-numCandles), currentSignal, oneMinuteMode, numCandles);
            
            // Check if this signal already exists in the table and preserve its outcome
            const existingSignal = signalRowsWithCurrent.find(s => s.time === lastCandle.x && s.action === currentSignal.action);
            const preservedOutcome = existingSignal?.outcome === 'True' || existingSignal?.outcome === 'False' 
              ? existingSignal.outcome 
              : 'Pending';
            const preservedEvaluation = existingSignal?.outcome === 'True' || existingSignal?.outcome === 'False'
              ? existingSignal.evaluation
              : 'Pending outcome';
            
            const currentSignalRow = {
              ...currentSignal,
              time: lastCandle.x,
              entry: levels.entry,
              target: levels.target,
              stopLoss: levels.stopLoss,
              levelSource: levels.levelSource,
              outcome: preservedOutcome,
              reason: `Live signal: ${currentSignal.reason}`,
              evaluation: preservedEvaluation,
            };
            // Add current signal at the beginning if it's not already there
            if (signalRowsWithCurrent.length === 0 || signalRowsWithCurrent[0].time !== lastCandle.x || signalRowsWithCurrent[0].action !== currentSignal.action) {
              signalRowsWithCurrent = [currentSignalRow, ...signalRowsWithCurrent];
            }
          }
        }

        // Monitor pending signals for target/stop loss hits (using candle high/low for gap handling)
        const monitoredSignalRows = signalRowsWithCurrent.map(signal => {
          if (signal.outcome === 'Pending' && signal.entry && signal.target && signal.stopLoss) {
            let updatedSignal = { ...signal };
            let outcomeChanged = false;
            
            // Get the current candle high/low (more accurate than single tick for gap scenarios)
            const lastCandle = updatedCandleData[updatedCandleData.length - 1];
            const candleHigh = lastCandle.h;
            const candleLow = lastCandle.l;
            
            if (signal.action === 'BUY') {
              // BUY: Target = candle HIGH reaches target, SL = candle LOW hits stop
              if (candleHigh >= signal.target) {
                updatedSignal.outcome = 'True';
                updatedSignal.evaluation = `Target ₹${signal.target.toFixed(2)} hit at high ₹${candleHigh.toFixed(2)}`;
                outcomeChanged = true;
              } else if (candleLow <= signal.stopLoss) {
                updatedSignal.outcome = 'False';
                updatedSignal.evaluation = `Stop loss ₹${signal.stopLoss.toFixed(2)} hit at low ₹${candleLow.toFixed(2)}`;
                outcomeChanged = true;
              }
            } else if (signal.action === 'SELL') {
              // SELL: Target = candle LOW reaches target, SL = candle HIGH hits stop
              if (candleLow <= signal.target) {
                updatedSignal.outcome = 'True';
                updatedSignal.evaluation = `Target ₹${signal.target.toFixed(2)} hit at low ₹${candleLow.toFixed(2)}`;
                outcomeChanged = true;
              } else if (candleHigh >= signal.stopLoss) {
                updatedSignal.outcome = 'False';
                updatedSignal.evaluation = `Stop loss ₹${signal.stopLoss.toFixed(2)} hit at high ₹${candleHigh.toFixed(2)}`;
                outcomeChanged = true;
              }
            }
            
            // Auto-exit trade if outcome changed and auto-trading is enabled
            if (outcomeChanged && autoTradingEnabled) {
              const exitAction = signal.action === 'BUY' ? 'SELL' : 'BUY';
              const exitPrice = updatedSignal.outcome === 'True' ? signal.target : signal.stopLoss;
              console.log(`[AutoTrade Exit] Executing ${exitAction} exit at ₹${exitPrice.toFixed(2)} for signal outcome: ${updatedSignal.outcome}`);
              
              // Call auto-exit trade function (implement in kiteAPI)
              executeAutoTradeExit(signal, exitAction, exitPrice, updatedSignal.outcome)
                .catch(err => console.error('[AutoTrade Exit] Failed to execute exit:', err));
            }
            
            return updatedSignal;
          }
          return signal;
        });

        setSignalRows(monitoredSignalRows);
        const reverseSignals = buildReverseSignalRows(monitoredSignalRows);
        setReverseSignalRows(reverseSignals);
     //   console.log(`[SignalGeneration] Original signals: ${monitoredSignalRows.length}, Reverse signals: ${reverseSignals.length}`);
        setEmaStrategyRows(buildEmaStrategyRows(monitoredSignalRows, { ema20: calculateEma(updatedCandleData, 20).at(-1)?.value || 0 }));

        // Update EMA series on chart if they exist - use latest point only
        const newEma10 = calculateEma(updatedCandleData, 10);
        const newEma20 = calculateEma(updatedCandleData, 20);

        if ((ema10SeriesRef.current || ema20SeriesRef.current) && newEma10.length > 0 && newEma20.length > 0) {
          const ema10Point = newEma10[newEma10.length - 1];
          const ema20Point = newEma20[newEma20.length - 1];

          if (ema10SeriesRef.current) {
            ema10SeriesRef.current.update(ema10Point);
        //    console.log(`[RealTimeSignals-EMA10] Updated: ${ema10Point.value.toFixed(2)}`);
          }
          if (ema20SeriesRef.current) {
            ema20SeriesRef.current.update(ema20Point);
         //   console.log(`[RealTimeSignals-EMA20] Updated: ${ema20Point.value.toFixed(2)}`);
          }
          setEma10Data(newEma10);
          setEma20Data(newEma20);
        }

      //  console.log(`[RealTimeSignals] Updated signals for ${selectedStrike.tradingSymbol} • ${selectedInterval} • LTP: ₹${livePrice.toFixed(2)}`);
      } else {
        // SAME CANDLE - Only monitor pending signals for target/SL hits, don't regenerate all signals
        console.log(`[Signals] ⏭️  SAME CANDLE (${candleData.length}) - No buildSignalRows, monitoring only...`);
        
        // Only monitor existing pending signals, don't call buildSignalRows
        const monitoredSignalRows = signalRows.map(signal => {
          if (signal.outcome === 'Pending' && signal.entry && signal.target && signal.stopLoss) {
            let updatedSignal = { ...signal };
            let outcomeChanged = false;
            
            // Get the current candle high/low (more accurate than single tick for gap scenarios)
            const lastCandle = updatedCandleData[updatedCandleData.length - 1];
            const candleHigh = lastCandle.h;
            const candleLow = lastCandle.l;
            
            if (signal.action === 'BUY') {
              // BUY: Target = candle HIGH reaches target, SL = candle LOW hits stop
              if (candleHigh >= signal.target) {
                updatedSignal.outcome = 'True';
                updatedSignal.evaluation = `Target ₹${signal.target.toFixed(2)} hit at high ₹${candleHigh.toFixed(2)}`;
                outcomeChanged = true;
              } else if (candleLow <= signal.stopLoss) {
                updatedSignal.outcome = 'False';
                updatedSignal.evaluation = `Stop loss ₹${signal.stopLoss.toFixed(2)} hit at low ₹${candleLow.toFixed(2)}`;
                outcomeChanged = true;
              }
            } else if (signal.action === 'SELL') {
              // SELL: Target = candle LOW reaches target, SL = candle HIGH hits stop
              if (candleLow <= signal.target) {
                updatedSignal.outcome = 'True';
                updatedSignal.evaluation = `Target ₹${signal.target.toFixed(2)} hit at low ₹${candleLow.toFixed(2)}`;
                outcomeChanged = true;
              } else if (candleHigh >= signal.stopLoss) {
                updatedSignal.outcome = 'False';
                updatedSignal.evaluation = `Stop loss ₹${signal.stopLoss.toFixed(2)} hit at high ₹${candleHigh.toFixed(2)}`;
                outcomeChanged = true;
              }
            }
            
            // Auto-exit trade if outcome changed and auto-trading is enabled
            if (outcomeChanged && autoTradingEnabled) {
              const exitAction = signal.action === 'BUY' ? 'SELL' : 'BUY';
              const exitPrice = updatedSignal.outcome === 'True' ? signal.target : signal.stopLoss;
              console.log(`[AutoTrade Exit] Executing ${exitAction} exit at ₹${exitPrice.toFixed(2)} for signal outcome: ${updatedSignal.outcome}`);
              
              // Call auto-exit trade function (implement in kiteAPI)
              executeAutoTradeExit(signal, exitAction, exitPrice, updatedSignal.outcome)
                .catch(err => console.error('[AutoTrade Exit] Failed to execute exit:', err));
            }
            
            return updatedSignal;
          }
          return signal;
        });

        setSignalRows(monitoredSignalRows);
        // No need to rebuild reverse signals or EMA signals - they don't change until new candle
      }
    } catch (err) {
      console.error('[RealTimeSignals] Failed to update signals with live price:', err);
    }
  }, [candleData.length, selectedStrike, selectedInterval]);

  // Periodically redraw full EMA data to ensure visibility and consistency
  useEffect(() => {
    if (!candleData.length || !ema10SeriesRef.current || !ema20SeriesRef.current) return;

    const redrawInterval = setInterval(() => {
      try {
        const fullEma10 = calculateEma(candleData, 10);
        const fullEma20 = calculateEma(candleData, 20);

        if (fullEma10.length > 0 && fullEma20.length > 0) {
          ema10SeriesRef.current.setData(fullEma10);
          ema20SeriesRef.current.setData(fullEma20);
        //  console.log(`[EMA Redraw] Redrawn full EMA lines for ${fullEma10.length} candles`);
        }
      } catch (err) {
        console.error('[EMA Redraw] Failed to redraw EMAs:', err);
      }
    }, 5000); // Redraw every 5 seconds

    return () => clearInterval(redrawInterval);
  }, [candleData]);

  // Update livePriceRef whenever livePrice changes (for access in other effects without triggering them)
  useEffect(() => {
    livePriceRef.current = livePrice;
  }, [livePrice]);

  // ========== NEW: Poll API Every 1 Minute for Latest Candle Data ==========
  // This fetches fresh candle data from the API every 60 seconds
  // When a new candle is detected (length increases), signals are regenerated
  useEffect(() => {
    if (!selectedStrike || !selectedInterval || candleData.length === 0) return;

    // Initialize ref on first run
    if (lastPolledLengthRef.current === 0) {
      lastPolledLengthRef.current = candleData.length;
    }

    const pollInterval = setInterval(async () => {
      try {
        const kiteAPI = new KiteAPI();
        const now = new Date();
        const from = new Date(now);
        
        // Get last 5 minutes of data (ensures we get the current candle)
        from.setMinutes(from.getMinutes() - 5);

        console.log(`[API-Poll] Fetching ${selectedInterval} candles at ${now.toLocaleTimeString()}`);

        const candles = await kiteAPI.getHistoricalData({
          instrumentToken: selectedStrike.instrumentToken,
          interval: selectedInterval,
          from: formatDateTime(from, '09:15:00'),
          to: formatDateTime(now, '23:59:59'),
        });

        if (Array.isArray(candles) && candles.length > 0) {
          // Convert API response to standard candle format
          const toCandleData = (rawCandles) => {
            const candlesByTimestamp = new Map();
            rawCandles.forEach((item) => {
              const timestamp = Array.isArray(item) ? item[0] : item?.timestamp;
              const candle = {
                x: new Date(timestamp).getTime(),
                o: Number(Array.isArray(item) ? item[1] : item?.open),
                h: Number(Array.isArray(item) ? item[2] : item?.high),
                l: Number(Array.isArray(item) ? item[3] : item?.low),
                c: Number(Array.isArray(item) ? item[4] : item?.close),
              };
              if (Number.isFinite(candle.x)
                && Number.isFinite(candle.o)
                && Number.isFinite(candle.h)
                && Number.isFinite(candle.l)
                && Number.isFinite(candle.c)) {
                candlesByTimestamp.set(candle.x, candle);
              }
            });
            return Array.from(candlesByTimestamp.values()).sort((first, second) => first.x - second.x);
          };

          const freshCandles = toCandleData(candles);
          const newLength = freshCandles.length;
          const lastPolledLength = lastPolledLengthRef.current;

          if (newLength !== lastPolledLength) {
            console.log(`[API-Poll] ✅ NEW CANDLE DETECTED! ${lastPolledLength} → ${newLength} candles`);
            lastPolledLengthRef.current = newLength; // Update ref immediately
            setCandleData(freshCandles);
            // Signal effect will detect the length change and regenerate signals
          } else {
            console.log(`[API-Poll] ⏭️  SAME CANDLE (${newLength} candles)`);
          }
        }
      } catch (err) {
        console.error('[API-Poll] Failed to fetch candle data:', err.message);
      }
    }, 60000); // 60 seconds = 1 minute

    return () => clearInterval(pollInterval);
  }, [selectedStrike, selectedInterval]); // ✅ REMOVED candleData.length to prevent effect restart
  // ========================================================================

  useEffect(() => {
    const availableExpiries = strikeOptions
      .filter(option => option.instrument === selectedInstrument)
      .map(option => option.expiry)
      .filter((expiry, index, values) => values.indexOf(expiry) === index)
      .sort();
    const nextExpiry = availableExpiries.includes(selectedExpiry) ? selectedExpiry : availableExpiries[0] || '';
    setSelectedExpiry(nextExpiry);
  }, [strikeOptions, selectedInstrument]);

  useEffect(() => {
    const availableStrikes = strikeOptions.filter(option => option.instrument === selectedInstrument && option.expiry === selectedExpiry);
    if (availableStrikes.length === 0) {
      setSelectedStrike(null);
      return;
    }
    if (!availableStrikes.some(option => option.instrumentToken === selectedStrike?.instrumentToken)) {
      const nearest = availableStrikes.reduce((best, current) => {
        const referencePrice = Number(nifty50Data?.last_price || 0);
        return Math.abs(current.strike - referencePrice) < Math.abs(best.strike - referencePrice) ? current : best;
      }, availableStrikes[0]);
      setSelectedStrike(nearest);
    }
  }, [strikeOptions, selectedInstrument, selectedExpiry, nifty50Data]);

  // Generate reverse signals from signal rows
  // Note: Already handled in the main real-time signals useEffect - removed to prevent infinite loop

  const fetchRealPCR = async (strike) => {
    if (!strike?.instrumentToken) return;
    
    // Skip PCR fetch if market is closed
    if (!checkMarketHours()) {
      console.log('[PCR] Skipping fetch - market is closed');
      return;
    }

    try {
      const kiteAPI = new KiteAPI();
      const optionChain = await kiteAPI.getNiftyOptionChain();
      const selectedStrikeNumber = Number(strike.strike);
      const selectedExpiry = String(strike.expiry || '');
      const selectedContracts = optionChain.filter((instrument) => {
        return Number(instrument.strike) === selectedStrikeNumber
          && String(instrument.expiry || '') === selectedExpiry
          && ['CE', 'PE'].includes(String(instrument.instrument_type || '').toUpperCase());
      });

      if (selectedContracts.length === 0) {
        return;
      }

      const quoteKeys = selectedContracts.map((instrument) => `${instrument.exchange}:${instrument.tradingsymbol}`);
      if (quoteKeys.length === 0) {
        return;
      }

      const quotes = await kiteAPI.getQuote(quoteKeys);
      const quoteEntries = selectedContracts.map((instrument) => ({
        type: String(instrument.instrument_type || '').toUpperCase(),
        quote: quotes[`${instrument.exchange}:${instrument.tradingsymbol}`] || {},
      }));
      const putVolume = quoteEntries
        .filter(({ type }) => type === 'PE')
        .reduce((sum, { quote }) => sum + Number(quote.volume || 0), 0);
      const callVolume = quoteEntries
        .filter(({ type }) => type === 'CE')
        .reduce((sum, { quote }) => sum + Number(quote.volume || 0), 0);
      const putOI = quoteEntries
        .filter(({ type }) => type === 'PE')
        .reduce((sum, { quote }) => sum + Number(quote.oi || 0), 0);
      const callOI = quoteEntries
        .filter(({ type }) => type === 'CE')
        .reduce((sum, { quote }) => sum + Number(quote.oi || 0), 0);

      const nextData = {
        strike: selectedStrikeNumber,
        expiry: selectedExpiry,
        put_volume: putVolume,
        call_volume: callVolume,
        put_oi: putOI,
        call_oi: callOI,
        pcr_volume: callVolume > 0 ? putVolume / callVolume : 0,
        pcr_oi: callOI > 0 ? putOI / callOI : 0,
      };

      setPcrData(nextData);
    } catch (err) {
      if (err.response?.status === 401) {
        setKiteSessionError('Kite session expired. Please reconnect your Kite account.');
      } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        if (!checkMarketHours()) {
          console.log('[PCR] Request timed out - market is closed');
        } else {
          console.warn('Real PCR fetch timeout, retrying...');
        }
      } else if (err.message.includes('Failed to fetch')) {
        // Market data not available - likely market closed
        if (!checkMarketHours()) {
          console.log('[PCR] Market data unavailable - market is closed');
        } else {
          console.error('Real PCR fetch failed:', err);
        }
      } else {
        console.error('Real PCR fetch failed:', err);
      }
    }
  };

  const fetchHistoricalChart = async (strike, interval) => {
    if (!strike?.instrumentToken) return;
    setChartLoading(true);

    try {
      const kiteAPI = new KiteAPI();
      const expiryDate = strike.expiry ? new Date(`${strike.expiry}T23:59:59`) : null;
      const hasExpired = expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate < new Date();
      const to = hasExpired ? expiryDate : new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - HISTORICAL_DATA_CONFIG.daysToFetch);
      const candles = await kiteAPI.getHistoricalData({
        instrumentToken: strike.instrumentToken,
        interval,
        from: formatDateTime(from, '09:15:00'),
        to: formatDateTime(to, '23:59:59'),
      });

      const normalized = Array.isArray(candles) ? candles : [];
      const toCandleData = (rawCandles) => {
        const candlesByTimestamp = new Map();
        rawCandles.forEach((item) => {
          const timestamp = Array.isArray(item) ? item[0] : item?.timestamp;
          const candle = {
            x: new Date(timestamp).getTime(),
            o: Number(Array.isArray(item) ? item[1] : item?.open),
            h: Number(Array.isArray(item) ? item[2] : item?.high),
            l: Number(Array.isArray(item) ? item[3] : item?.low),
            c: Number(Array.isArray(item) ? item[4] : item?.close),
          };
          if (Number.isFinite(candle.x)
            && Number.isFinite(candle.o)
            && Number.isFinite(candle.h)
            && Number.isFinite(candle.l)
            && Number.isFinite(candle.c)) {
            candlesByTimestamp.set(candle.x, candle);
          }
        });
        return Array.from(candlesByTimestamp.values()).sort((first, second) => first.x - second.x);
      };
      const candleData = toCandleData(normalized);
      const decisionCandleData = candleData;
      const oneMinuteMode = interval === 'minute';
      
      // Log data volume for monitoring
      console.log(`[Chart] Loaded ${candleData.length} candles for ${interval} interval (${HISTORICAL_DATA_CONFIG.daysToFetch} days - ${HISTORICAL_DATA_CONFIG.description})`);
      
      let fiveMinuteCandleData = [];
      let threeMinuteCandleData = [];

      if (oneMinuteMode) {
        const [fiveMinuteCandles, threeMinuteCandles] = await Promise.all([
          kiteAPI.getHistoricalData({
            instrumentToken: strike.instrumentToken,
            interval: '5minute',
            from: formatDateTime(from, '09:15:00'),
            to: formatDateTime(to, '23:59:59'),
          }),
          kiteAPI.getHistoricalData({
            instrumentToken: strike.instrumentToken,
            interval: '3minute',
            from: formatDateTime(from, '09:15:00'),
            to: formatDateTime(to, '23:59:59'),
          }),
        ]);
        fiveMinuteCandleData = toCandleData(Array.isArray(fiveMinuteCandles) ? fiveMinuteCandles : []);
        threeMinuteCandleData = toCandleData(Array.isArray(threeMinuteCandles) ? threeMinuteCandles : []);
        setFiveMinuteCandleData(fiveMinuteCandleData);
        setThreeMinuteCandleData(threeMinuteCandleData);
      } else {
        setFiveMinuteCandleData([]);
        setThreeMinuteCandleData([]);
      }

      const latest = normalized[normalized.length - 1];
      setLatestCandle(
        Array.isArray(latest)
          ? { open: latest[1], high: latest[2], low: latest[3], close: latest[4], volume: latest[5], oi: latest[6] }
          : latest || null
      );

      const currentSignal = calculateTradeSignal(decisionCandleData, oneMinuteMode, fiveMinuteCandleData, threeMinuteCandleData, numCandles);
      setCandleData(candleData);
      setTradeSignal(currentSignal);
      setAutoTradePlan(calculateCurrentTradePlan(decisionCandleData, currentSignal));
      const historicalRows = buildSignalRows(decisionCandleData, oneMinuteMode, fiveMinuteCandleData, threeMinuteCandleData, numCandles);

      // Add current live signal to the top of the table if it's not a HOLD
      let signalRowsWithCurrent = historicalRows;
      if (currentSignal.action !== 'HOLD') {
        const lastCandle = decisionCandleData[decisionCandleData.length - 1];
        const levels = calculateTradeLevels(decisionCandleData.slice(-numCandles), currentSignal, oneMinuteMode, numCandles);
        const currentSignalRow = {
          ...currentSignal,
          time: lastCandle.x,
          entry: levels.entry,
          target: levels.target,
          stopLoss: levels.stopLoss,
          levelSource: levels.levelSource,
          outcome: 'Pending',
          reason: `Live signal: ${currentSignal.reason}`,
          evaluation: 'Pending outcome',
        };
        // Add current signal at the beginning if it's not already there
        if (historicalRows.length === 0 || historicalRows[0].time !== lastCandle.x || historicalRows[0].action !== currentSignal.action) {
          signalRowsWithCurrent = [currentSignalRow, ...historicalRows];
        }
      }

      setSignalRows(signalRowsWithCurrent);

      // Fetch opposite strike candle data for buy-only reverse signals
      try {
        const oppositeType = strike.type === 'PE' ? 'CE' : 'PE';
        const oppositeStrike = strikeOptions.find(
          option => option.strike === strike.strike
            && option.expiry === strike.expiry
            && option.type === oppositeType
        );
      } catch (err) {
        console.error('Failed to fetch opposite strike data:', err);
      }

      setCloseChartData({
        datasets: [{
          label: `${strike.label} close • ${interval}`,
          data: candleData.map(candle => ({ x: candle.x, y: candle.c })),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.15,
          fill: true,
        }],
      });
      setRsiChartData({
        datasets: [{
          label: 'RSI (14)',
          data: calculateRsi(candleData),
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167, 139, 250, 0.12)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
          spanGaps: true,
        }],
      });
    } catch (err) {
      if (err.response?.status === 401) {
        setKiteSessionError('Kite session expired. Please reconnect your Kite account.');
      } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        setKiteSessionError('Request timeout. Check your connection.');
      } else {
        setError(err.message);
      }
      console.error('Chart fetch failed:', err);
    } finally {
      setChartLoading(false);
    }
  };

  const startAutomaticTrading = async () => {
    if (!autoTradingAcknowledged) {
      setAutoTradingStatus('Confirm the live-order acknowledgement before starting.');
      return;
    }
    setAutoTradingBusy(true);
    try {
      const kiteAPI = new KiteAPI();
      await kiteAPI.startAutomaticTrading();
      setSubmittedAutoSignalKey('');
      setAutoTradingEnabled(true);
      setAutoTradingStatus('Automatic trading is armed. It will place one order only for the next confirmed signal.');
    } catch (err) {
      setAutoTradingStatus(err.response?.data?.error || err.message || 'Unable to start automatic trading.');
    } finally {
      setAutoTradingBusy(false);
    }
  };

  const stopAutomaticTrading = async () => {
    setAutoTradingBusy(true);
    try {
      const kiteAPI = new KiteAPI();
      await kiteAPI.stopAutomaticTrading();
      setAutoTradingEnabled(false);
      setAutoTradingStatus('Automatic trading stopped. Any active automatic position was closed.');
    } catch (err) {
      setAutoTradingStatus(err.response?.data?.error || err.message || 'Unable to stop automatic trading.');
    } finally {
      setAutoTradingBusy(false);
    }
  };

  useEffect(() => {
    if (!autoTradingEnabled || !autoTradePlan || !selectedStrike) return undefined;
    const signalKey = `${selectedStrike.tradingsymbol}:${autoTradePlan.action}:${autoTradePlan.time}`;
    if (submittedAutoSignalKey === signalKey) return undefined;

    let cancelled = false;
    const submitSignal = async () => {
      setSubmittedAutoSignalKey(signalKey);
      setAutoTradingStatus(`Setting up price alerts for target and stop loss...`);
      try {
        const kiteAPI = new KiteAPI();
        
        // Place MARKET entry order (executes immediately at current price)
        const entryOrder = await kiteAPI.submitMarketOrder({
          action: autoTradePlan.action,
          exchange: 'NFO',
          tradingsymbol: selectedStrike.tradingsymbol,
          quantity: Number(selectedStrike.lotSize) || 1,
          orderType: 'MARKET', // Market order - fills immediately
          signalTime: autoTradePlan.time,
        });

        console.log(`[AutoTrade Entry] MARKET entry order placed: ${autoTradePlan.action} at current price (Order ID: ${entryOrder.orderId})`);

        // Set up TARGET price alert
        const targetAlert = await kiteAPI.createPriceAlert({
          instrumentToken: selectedStrike.instrumentToken,
          alertType: 'TARGET_HIT',
          triggerPrice: autoTradePlan.target,
          signalId: signalKey,
          exchange: 'NFO',
          tradingsymbol: selectedStrike.tradingsymbol,
        });

        // Set up STOPLOSS price alert
        const slAlert = await kiteAPI.createPriceAlert({
          instrumentToken: selectedStrike.instrumentToken,
          alertType: 'STOPLOSS_HIT',
          triggerPrice: autoTradePlan.stopLoss,
          signalId: signalKey,
          exchange: 'NFO',
          tradingsymbol: selectedStrike.tradingsymbol,
        });

        if (!cancelled) {
          setAutoTradingStatus(
            `✓ Entry MARKET order filled (ID: ${entryOrder.orderId})\n` +
            `📊 TARGET Alert: ₹${autoTradePlan.target.toFixed(2)} (Alert ID: ${targetAlert.alertId})\n` +
            `🛑 STOPLOSS Alert: ₹${autoTradePlan.stopLoss.toFixed(2)} (Alert ID: ${slAlert.alertId})\n` +
            `When either alert triggers, position will AUTO-EXIT with MARKET order at current price.`
          );
          console.log(`[AutoTrade] Price alerts set: Target ₹${autoTradePlan.target.toFixed(2)}, SL ₹${autoTradePlan.stopLoss.toFixed(2)}`);
        }
      } catch (err) {
        if (!cancelled) setAutoTradingStatus(err.response?.data?.error || err.message || 'Automatic order was rejected.');
      }
    };
    submitSignal();
    return () => { cancelled = true };
  }, [autoTradePlan, autoTradingEnabled, selectedStrike, submittedAutoSignalKey]);

  // Auto-execute exit trades when signal outcome changes (using MARKET orders + PRICE ALERTS)
  const executeAutoTradeExit = async (signal, exitAction, exitPrice, outcome) => {
    if (!autoTradingEnabled || !selectedStrike) {
      console.log('[AutoTradeExit] Auto-trading not enabled or strike not selected');
      return;
    }

    try {
      setAutoTradingBusy(true);
      const kiteAPI = new KiteAPI();
      
      // Instead of placing limit order with target/SL, create price alert
      // When price alert triggers (target >= price OR SL <= price), execute MARKET exit order
      const priceAlertType = outcome === 'True' ? 'TARGET_HIT' : 'STOPLOSS_HIT';
      const alertTriggerPrice = outcome === 'True' ? signal.target : signal.stopLoss;
      
      // Set up price alert for this signal
      const priceAlert = await kiteAPI.createPriceAlert({
        instrumentToken: selectedStrike.instrumentToken,
        alertType: priceAlertType,
        triggerPrice: alertTriggerPrice,
        signalId: `${signal.time}-${signal.action}`,
        exchange: 'NFO',
        tradingsymbol: selectedStrike.tradingsymbol,
      });

      console.log(`[PriceAlert] Alert created: ${priceAlertType} at ₹${alertTriggerPrice.toFixed(2)} (Alert ID: ${priceAlert.alertId})`);

      // When alert triggers, execute MARKET exit order (not limit order)
      const exitOrder = await kiteAPI.submitMarketOrder({
        action: exitAction, // SELL if we BUY, BUY if we SELL
        exchange: 'NFO',
        tradingsymbol: selectedStrike.tradingsymbol,
        quantity: Number(selectedStrike.lotSize) || 1,
        orderType: 'MARKET', // Market order - executes immediately at current price
        signalTime: Date.now(),
      });

      setAutoTradingStatus(
        outcome === 'True'
          ? `✓ TARGET ALERT: Price Alert set at ₹${alertTriggerPrice.toFixed(2)}. When triggered, MARKET ${exitAction} exit order will execute (Alert ID: ${priceAlert.alertId}, Order ID: ${exitOrder.orderId})`
          : `✗ STOPLOSS ALERT: Price Alert set at ₹${alertTriggerPrice.toFixed(2)}. When triggered, MARKET ${exitAction} exit order will execute (Alert ID: ${priceAlert.alertId}, Order ID: ${exitOrder.orderId})`
      );
      
      console.log(`[AutoTradeExit] MARKET exit order ready for alert trigger at ₹${alertTriggerPrice.toFixed(2)}`);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to execute exit order';
      setAutoTradingStatus(`Auto-exit failed: ${errorMsg}`);
      console.error('[AutoTradeExit] Failed to execute:', err);
    } finally {
      setAutoTradingBusy(false);
    }
  };

  const fetchPCRData = async () => {
    setLoading(true);
    setError(null);
    try {
      const kiteAPI = new KiteAPI();
      const niftyData = await kiteAPI.getNifty50Data();
      const niftyIndex = niftyData['NSE:NIFTY 50'] || {};
      setNifty50Data(niftyIndex);

      const strikes = await kiteAPI.getNiftyStrikeOptions();
      setStrikeOptions(strikes);
      const instruments = strikes.map(option => option.instrument).filter((instrument, index, values) => values.indexOf(instrument) === index);
      if (!instruments.includes(selectedInstrument)) setSelectedInstrument(instruments.includes('NIFTY') ? 'NIFTY' : instruments[0] || '');
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (pcr) => {
    if (pcr < 0.8) return '#28a745';
    if (pcr < 1.0) return '#84fab0';
    if (pcr < 1.2) return '#ffc107';
    return '#fa709a';
  };

  const getSentimentLabel = (pcr) => {
    if (pcr < 0.8) return 'Strong Bullish';
    if (pcr < 1.0) return 'Bullish';
    if (pcr < 1.2) return 'Neutral';
    return 'Bearish';
  };

  const formatDateTime = (value, time) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} ${time}`;
  };

  if (loading) {
    return <div className="card"><div className="loading">Loading PCR data...</div></div>;
  }

  if (!nifty50Data) {
    return <div className="card"><div className="error-message">Unable to load Nifty market data</div></div>;
  }

  const pcrVolume = pcrData?.pcr_volume || 0;
  const pcrOI = pcrData?.pcr_oi || 0;
  const instrumentOptions = strikeOptions.map(option => option.instrument).filter((instrument, index, values) => values.indexOf(instrument) === index).sort();
  const expiryOptions = strikeOptions.filter(option => option.instrument === selectedInstrument)
    .map(option => option.expiry).filter((expiry, index, values) => values.indexOf(expiry) === index).sort();
  const visibleStrikeOptions = strikeOptions.filter(option => option.instrument === selectedInstrument && option.expiry === selectedExpiry);

  // Get unique days from signal rows (last 10 trading days only)
  const uniqueDays = [...new Set(signalRows.map(signal => {
    const date = new Date(signal.time);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }))].sort().reverse().slice(0, TRADING_CONSTANTS.MAX_TRADING_DAYS);

  // Filter by action and day
  const filteredSignalRows = signalRows.filter(signal => {
    const actionMatch = signalFilter === 'ALL' || signal.action === signalFilter;
    if (!actionMatch) return false;

    if (dayFilter === 'ALL') return true;
    const signalDate = new Date(signal.time).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    return signalDate === dayFilter;
  });

  const evaluatedSignals = filteredSignalRows.filter(signal => signal.outcome === 'True' || signal.outcome === 'False');
  const successfulSignals = evaluatedSignals.filter(signal => signal.outcome === 'True');
  const overallSuccess = evaluatedSignals.length > 0
    ? (successfulSignals.length / evaluatedSignals.length) * 100
    : 0;
  const lotSize = Number(selectedStrike?.lotSize) || 1;
  const tradeCostForSignal = (signal) => calculateTradeCost(signal.entry, lotSize);
  const latestTradeCost = filteredSignalRows.length > 0
    ? tradeCostForSignal(filteredSignalRows[0])
    : null;
  const winAmount = evaluatedSignals
    .filter(signal => signal.outcome === 'True')
    .reduce((total, signal) => total + (Math.abs(signal.target - signal.entry) * lotSize) + tradeCostForSignal(signal).totalCharges, 0);
  const lossAmount = evaluatedSignals
    .filter(signal => signal.outcome === 'False')
    .reduce((total, signal) => total + (Math.abs(signal.stopLoss - signal.entry) * lotSize) + tradeCostForSignal(signal).totalCharges, 0);
  const winAmountPercent = (winAmount + lossAmount) > 0 ? (winAmount / (winAmount + lossAmount)) * 100 : 0;
  const strategyReview = getStrategyReview(filteredSignalRows);
  const realizedInvestment = evaluatedSignals.reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);
  const realizedProfitLoss = evaluatedSignals.reduce((total, signal) => {
    const priceMove = signal.outcome === 'True'
      ? Math.abs(signal.target - signal.entry)
      : -Math.abs(signal.stopLoss - signal.entry);
    const cost = tradeCostForSignal(signal);
    return total + ((priceMove * lotSize) - cost.totalCharges);
  }, 0);
  const pendingInvestment = filteredSignalRows
    .filter(signal => signal.outcome === 'Pending')
    .reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);

  // Current P/L calculations (based on current price from chart data, not target/stop loss)
  const currentPLSignals = filteredSignalRows.map(signal => {
    const signalCandle = candleData.find(candle => candle.x === signal.time);
    const priceAtSignalTime = signalCandle?.c || signal.entry;
    const currentPLPoints = signal.action === 'BUY' 
      ? priceAtSignalTime - signal.entry 
      : signal.entry - priceAtSignalTime;
    return { ...signal, currentPLPoints, priceAtSignalTime };
  });

  const currentPLRealizedInvestment = filteredSignalRows.reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);
  const currentPLRealizedAmount = currentPLSignals.reduce((total, signal) => {
    const currentPL = signal.currentPLPoints * lotSize;
    return total + currentPL;
  }, 0);
  const currentPLRealizedProfitLoss = currentPLRealizedAmount - (filteredSignalRows.reduce((total, signal) => total + tradeCostForSignal(signal).totalCharges, 0));
  const currentPLPendingInvestment = filteredSignalRows
    .filter(signal => signal.outcome === 'Pending')
    .reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);

  // Reverse signals filtering and calculations
  // Note: Reverse signals have opposite actions (BUY <-> SELL), so we don't filter by action
  // Instead, show ALL reverse signals regardless of the BUY/SELL filter
  const filteredReverseSignalRows = reverseSignalRows.filter(signal => {
    // Don't filter by action for reverse signals - they're inverse of originals
    // Show all reverse signals or filter by day only
    if (dayFilter === 'ALL') return true;
    const signalDate = new Date(signal.time).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    return signalDate === dayFilter;
  });

  const evaluatedReverseSignals = filteredReverseSignalRows.filter(signal => signal.outcome === 'True' || signal.outcome === 'False');
  const successfulReverseSignals = evaluatedReverseSignals.filter(signal => signal.outcome === 'True');
  const reverseOverallSuccess = evaluatedReverseSignals.length > 0
    ? (successfulReverseSignals.length / evaluatedReverseSignals.length) * 100
    : 0;
  const latestReverseSignalTradeCost = filteredReverseSignalRows.length > 0
    ? tradeCostForSignal(filteredReverseSignalRows[0])
    : null;
  const reverseWinAmount = evaluatedReverseSignals
    .filter(signal => signal.outcome === 'True')
    .reduce((total, signal) => total + (Math.abs(signal.target - signal.entry) * lotSize) + tradeCostForSignal(signal).totalCharges, 0);
  const reverseLossAmount = evaluatedReverseSignals
    .filter(signal => signal.outcome === 'False')
    .reduce((total, signal) => total + (Math.abs(signal.stopLoss - signal.entry) * lotSize) + tradeCostForSignal(signal).totalCharges, 0);
  const reverseWinAmountPercent = (reverseWinAmount + reverseLossAmount) > 0 ? (reverseWinAmount / (reverseWinAmount + reverseLossAmount)) * 100 : 0;
  const reverseRealizedInvestment = evaluatedReverseSignals.reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);
  const reverseRealizedProfitLoss = evaluatedReverseSignals.reduce((total, signal) => {
    const priceMove = signal.outcome === 'True'
      ? Math.abs(signal.target - signal.entry)
      : -Math.abs(signal.stopLoss - signal.entry);
    const cost = tradeCostForSignal(signal);
    return total + ((priceMove * lotSize) - cost.totalCharges);
  }, 0);
  const reversePendingInvestment = filteredReverseSignalRows
    .filter(signal => signal.outcome === 'Pending')
    .reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);

  // Current P/L calculations for Reverse signals
  const reverseCurrentPLSignals = filteredReverseSignalRows.map(signal => {
    const signalCandle = candleData.find(candle => candle.x === signal.time);
    const priceAtSignalTime = signalCandle?.c || signal.entry;
    const currentPLPoints = signal.action === 'SELL' 
      ? signal.entry - priceAtSignalTime 
      : priceAtSignalTime - signal.entry;
    return { ...signal, currentPLPoints, priceAtSignalTime };
  });

  const reverseCurrentPLRealizedInvestment = filteredReverseSignalRows.reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);
  const reverseCurrentPLRealizedAmount = reverseCurrentPLSignals.reduce((total, signal) => {
    const currentPL = signal.currentPLPoints * lotSize;
    return total + currentPL;
  }, 0);
  const reverseCurrentPLRealizedProfitLoss = reverseCurrentPLRealizedAmount - (filteredReverseSignalRows.reduce((total, signal) => total + tradeCostForSignal(signal).totalCharges, 0));

  // EMA Strategy signals filtering and calculations
  const filteredEmaStrategyRows = emaStrategyRows.filter(signal => {
    const actionMatch = signalFilter === 'ALL' || signal.action === signalFilter;
    if (!actionMatch) return false;

    if (dayFilter === 'ALL') return true;
    const signalDate = new Date(signal.time).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    return signalDate === dayFilter;
  });

  const evaluatedEmaSignals = filteredEmaStrategyRows.filter(signal => signal.outcome === 'True' || signal.outcome === 'False');
  const successfulEmaSignals = evaluatedEmaSignals.filter(signal => signal.outcome === 'True');
  const emaOverallSuccess = evaluatedEmaSignals.length > 0
    ? (successfulEmaSignals.length / evaluatedEmaSignals.length) * 100
    : 0;
  const latestEmaSignalTradeCost = filteredEmaStrategyRows.length > 0
    ? tradeCostForSignal(filteredEmaStrategyRows[0])
    : null;
  const emaWinAmount = evaluatedEmaSignals
    .filter(signal => signal.outcome === 'True')
    .reduce((total, signal) => total + (Math.abs(signal.target - signal.entry) * lotSize) + tradeCostForSignal(signal).totalCharges, 0);
  const emaLossAmount = evaluatedEmaSignals
    .filter(signal => signal.outcome === 'False')
    .reduce((total, signal) => total + (Math.abs(signal.stopLoss - signal.entry) * lotSize) + tradeCostForSignal(signal).totalCharges, 0);
  const emaWinAmountPercent = (emaWinAmount + emaLossAmount) > 0 ? (emaWinAmount / (emaWinAmount + emaLossAmount)) * 100 : 0;
  const emaRealizedInvestment = evaluatedEmaSignals.reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);
  const emaRealizedProfitLoss = evaluatedEmaSignals.reduce((total, signal) => {
    const priceMove = signal.outcome === 'True'
      ? Math.abs(signal.target - signal.entry)
      : -Math.abs(signal.stopLoss - signal.entry);
    const cost = tradeCostForSignal(signal);
    return total + ((priceMove * lotSize) - cost.totalCharges);
  }, 0);
  const emaPendingInvestment = filteredEmaStrategyRows
    .filter(signal => signal.outcome === 'Pending')
    .reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);

  // Current P/L calculations for EMA Strategy signals
  const emaCurrentPLSignals = filteredEmaStrategyRows.map(signal => {
    const signalCandle = candleData.find(candle => candle.x === signal.time);
    const priceAtSignalTime = signalCandle?.c || signal.entry;
    const currentPLPoints = signal.action === 'BUY' 
      ? priceAtSignalTime - signal.entry 
      : signal.entry - priceAtSignalTime;
    return { ...signal, currentPLPoints, priceAtSignalTime };
  });

  const emaCurrentPLRealizedInvestment = filteredEmaStrategyRows.reduce((total, signal) => total + tradeCostForSignal(signal).totalCashRequired, 0);
  const emaCurrentPLRealizedAmount = emaCurrentPLSignals.reduce((total, signal) => {
    const currentPL = signal.currentPLPoints * lotSize;
    return total + currentPL;
  }, 0);
  const emaCurrentPLRealizedProfitLoss = emaCurrentPLRealizedAmount - (filteredEmaStrategyRows.reduce((total, signal) => total + tradeCostForSignal(signal).totalCharges, 0));

  const downloadSignalsJson = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      strike: selectedStrike?.label || null,
      timeframe: selectedInterval,
      filter: signalFilter,
      lotSize,
      signals: filteredSignalRows,
    };
    const file = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `signals-${selectedInterval}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="pcr-container">
      <div className="pcr-layout">
        <section className="pcr-analysis-box">
          <div className="pcr-header">
            <h2>📈 Nifty 50 Put-Call Ratio Analysis</h2>
            <button onClick={fetchPCRData} className="refresh-btn">🔄 Refresh</button>
          </div>

          {error && <div className="error-message">{error}</div>}
          {kiteSessionError && <div className="error-message" style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>⚠️ {kiteSessionError}</div>}

          <div className="nifty-info">
            <div className="nifty-price">
              <span className="label">NIFTY 50</span>
              <span className="price">
                {nifty50Data.last_price ? `${nifty50Data.last_price.toFixed(2)}` : 'N/A'}
              </span>
            </div>
            <div className={`nifty-change ${nifty50Data.last_traded_quantity >= 0 ? 'positive' : 'negative'}`}>
              <span className="label">Change</span>
              <span className="value">
                {nifty50Data.net_change >= 0 ? '▲' : '▼'} {nifty50Data.net_change?.toFixed(2)} ({nifty50Data.change_percent?.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="pcr-metrics">
            <div className="metric">
              <div className="metric-label">CE Call Volume</div>
              <div className="metric-value" style={{ color: '#2563eb' }}>
                {Number(pcrData?.call_volume || 0).toLocaleString()}
              </div>
              <div className="metric-sentiment">Selected strike</div>
            </div>

            <div className="metric">
              <div className="metric-label">PE Put Volume</div>
              <div className="metric-value" style={{ color: '#dc2626' }}>
                {Number(pcrData?.put_volume || 0).toLocaleString()}
              </div>
              <div className="metric-sentiment">Selected strike</div>
            </div>

            <div className="metric">
              <div className="metric-label">PCR - Volume</div>
              <div className="metric-value" style={{ color: getSentimentColor(pcrVolume) }}>
                {pcrVolume.toFixed(3)}
              </div>
              <div className="metric-sentiment">PE volume / CE volume</div>
            </div>

            <div className="metric">
              <div className="metric-label">PCR - Open Interest</div>
              <div className="metric-value" style={{ color: getSentimentColor(pcrOI) }}>
                {pcrOI.toFixed(3)}
              </div>
              <div className="metric-sentiment">PE OI / CE OI</div>
            </div>
          </div>
        </section>

        <div className="chart-panel">
          <div className="chart-header">
            <h3>📉 Nifty Historical Chart</h3>
          </div>
          <div className="chart-controls">
            <label>
              Instrument
              <select value={selectedInstrument} onChange={(event) => setSelectedInstrument(event.target.value)} disabled={instrumentOptions.length === 0}>
                {instrumentOptions.map(instrument => <option key={instrument} value={instrument}>{instrument}</option>)}
              </select>
            </label>

            <label>
              Expiry
              <select value={selectedExpiry} onChange={(event) => setSelectedExpiry(event.target.value)} disabled={expiryOptions.length === 0}>
                {expiryOptions.map(expiry => <option key={expiry} value={expiry}>{expiry}</option>)}
              </select>
            </label>

            <label>
              Strike
              <select
                value={selectedStrike ? selectedStrike.instrumentToken : ''}
                onChange={(event) => {
                  const match = strikeOptions.find(option => String(option.instrumentToken) === event.target.value);
                  setSelectedStrike(match || null);
                }}
                disabled={visibleStrikeOptions.length === 0}
              >
                {visibleStrikeOptions.length === 0 ? <option value="">Loading strikes...</option> : visibleStrikeOptions.map((option) => (
                  <option key={option.instrumentToken} value={option.instrumentToken}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Time Frame
              <select
                value={selectedInterval}
                onChange={(event) => setSelectedInterval(event.target.value)}
              >
                {TIMEFRAME_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label>
              Candles for Pattern Detection
              <input
                type="number"
                value={numCandles}
                onChange={(event) => setNumCandles(Math.max(TRADING_CONSTANTS.MIN_CANDLES, parseInt(event.target.value) || TRADING_CONSTANTS.DEFAULT_CANDLES))}
                min={TRADING_CONSTANTS.MIN_CANDLES}
                max={TRADING_CONSTANTS.MAX_CANDLES}
                title={`Number of past candles to use for detecting patterns (${TRADING_CONSTANTS.MIN_CANDLES}-${TRADING_CONSTANTS.MAX_CANDLES})`}
              />
            </label>
          </div>

          {latestCandle && (
            <div className="ohlc-summary">
              <div className="ohlc-box"><span>Time (IST)</span><strong>{latestCandle.time ? new Date(latestCandle.time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}</strong></div>
              <div className="ohlc-box"><span>Open</span><strong>₹{Number(latestCandle.open || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>High</span><strong>₹{Number(latestCandle.high || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Low</span><strong>₹{Number(latestCandle.low || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Close</span><strong>₹{Number(latestCandle.close || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Live LTP</span><strong>₹{Number(livePrice ?? latestCandle.close ?? 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Volume</span><strong>{Number(latestCandle.volume || 0).toLocaleString()}</strong></div>
            </div>
          )}

          <div className={`trade-signal ${tradeSignal.action.toLowerCase()}`}>
            <div className="trade-signal-action">{tradeSignal.action}</div>
            <div>
              <strong>{tradeSignal.pattern}</strong>
              <span>{tradeSignal.reason}</span>
              {selectedInterval === 'minute' && tradeSignal.minuteConfirmation && (
                <div className="minute-confirmation">
                  <span>{tradeSignal.minuteConfirmation.candlestick}</span>
                  <span>{tradeSignal.minuteConfirmation.chart}</span>
                  <span>{tradeSignal.minuteConfirmation.threeMinuteChart}</span>
                  <span>{tradeSignal.minuteConfirmation.fiveMinuteChart}</span>
                  <span>{tradeSignal.minuteConfirmation.ema}</span>
                  <span>{tradeSignal.minuteConfirmation.emaStatus || tradeSignal.minuteConfirmation.status}</span>
                </div>
              )}
            </div>
          </div>

          <section className={`auto-trading-panel ${autoTradingEnabled ? 'armed' : ''}`}>
            <AutoTradePanel
              autoTradingEnabled={autoTradingEnabled}
              autoTradingAcknowledged={autoTradingAcknowledged}
              autoTradingStatus={autoTradingStatus}
              autoTradingBusy={autoTradingBusy}
              autoTradePlan={autoTradePlan}
              onStartAutomaticTrading={startAutomaticTrading}
              onStopAutomaticTrading={stopAutomaticTrading}
              onAcknowledgeTrading={() => setAutoTradingAcknowledged(true)}
            />
          </section>

          {chartLoading ? (
            <div className="chart-loading">Loading chart...</div>
          ) : candleData.length > 0 ? (
            <div className="chart-stack">
              <section className="chart-block">
                <h4>OHLC Candlesticks <span className="chart-legend"><i className="legend-candle" /> Candle <i className="legend-ema20" /> EMA10 <i className="legend-ema50" /> EMA20</span></h4>
                <CandlestickChart
                  candleData={candleData}
                  ema10Data={ema10Data}
                  ema20Data={ema20Data}
                  selectedInterval={selectedInterval}
                  livePrice={livePrice}
                  onChartRef={(refs) => {
                    chartSeriesRef.current = refs.chartSeriesRef.current;
                    ema10SeriesRef.current = refs.ema10SeriesRef.current;
                    ema20SeriesRef.current = refs.ema20SeriesRef.current;
                    lastCandleOpenRef.current = refs.lastCandleOpenRef.current;
                    currentCandleBoundaryRef.current = refs.currentCandleBoundaryRef.current;
                    currentCandleDataRef.current = refs.currentCandleDataRef.current;
                  }}
                />
              </section>

              <section className="chart-block indicator-block">
                <h4>RSI (14) <span className="indicator-range">Overbought 70&nbsp;&nbsp; Oversold 30</span></h4>
                <div className="chart-wrapper indicator-wrapper">
                  <Line
                    data={rsiChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                      scales: {
                        x: { type: 'time', time: { unit: selectedInterval === 'day' ? 'day' : 'hour' }, ticks: { maxTicksLimit: 8, color: '#94a3b8' }, grid: { color: '#243244' } },
                        y: { min: 0, max: 100, ticks: { color: '#94a3b8', callback: value => value }, grid: { color: '#243244' } },
                      },
                    }}
                  />
                </div>
              </section>

              <section className="chart-block">
                <h4>Closing Price Trend</h4>
                <div className="chart-wrapper">
                  <Line
                    data={closeChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: true },
                        tooltip: { mode: 'index', intersect: false },
                      },
                      scales: {
                        x: {
                          type: 'time',
                          time: { unit: selectedInterval === 'day' ? 'day' : 'hour' },
                          ticks: { maxTicksLimit: 8 },
                        },
                        y: {
                          display: true,
                          ticks: { callback: (value) => `₹${value}` },
                        },
                      },
                    }}
                  />
                </div>
              </section>
            </div>
          ) : (
            <div className="chart-empty">Select a strike and timeframe to view historical candles.</div>
          )}

          <section className="signal-table-panel">
            <div className="signal-table-header">
              <h3>{selectedInterval === 'minute' ? 'Combined Signals (1m multi-confirmation)' : 'Combined Signals'}</h3>
              <div className="signal-filter-row">
                <label>
                  View:
                  <select value={signalFilter} onChange={(event) => setSignalFilter(event.target.value)}>
                    <option value="ALL">All</option>
                    <option value="BUY">Buy only</option>
                    <option value="SELL">Sell only</option>
                  </select>
                </label>
                <label>
                  Day:
                  <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
                    <option value="ALL">All Days</option>
                    {uniqueDays.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="download-signals-btn" onClick={downloadSignalsJson} disabled={filteredSignalRows.length === 0}>Download JSON</button>
              </div>
              <div className="signal-summary">
                <span>{filteredSignalRows.length} decisions | Overall success: {overallSuccess.toFixed(1)}%</span>
                {latestTradeCost && <span>Latest one-trade cost: ₹{latestTradeCost.totalCashRequired.toFixed(2)} (Premium ₹{latestTradeCost.notional.toFixed(2)} + charges ₹{latestTradeCost.totalCharges.toFixed(2)})</span>}
                <span>Win amount: {winAmountPercent.toFixed(1)}% | Completed investment: ₹{realizedInvestment.toFixed(2)}</span>
                <span><b>📈 ORIGINAL P/L:</b> Gross P/L: <b className={realizedProfitLoss >= 0 ? 'profit' : 'loss'}>{realizedProfitLoss >= 0 ? '+' : ''}₹{realizedProfitLoss.toFixed(2)}</b> | Pending investment: ₹{pendingInvestment.toFixed(2)} | Lot size: {lotSize}</span>
                <span><b>💹 CURRENT P/L:</b> Gross P/L: <b className={currentPLRealizedProfitLoss >= 0 ? 'profit' : 'loss'}>{currentPLRealizedProfitLoss >= 0 ? '+' : ''}₹{currentPLRealizedProfitLoss.toFixed(2)}</b> | Investment: ₹{currentPLRealizedInvestment.toFixed(2)}</span>
                <hr style={{ margin: '8px 0' }} />
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  <b>📊 Column Info:</b> "Profit/Loss Points" = Original (Entry → Target/Stop Loss) | "Current P/L Points" = Current (Entry → Current Price)
                </span>
              </div>
            </div>
            {strategyReview.length > 0 && (
              <div className="strategy-review">
                <strong>Failed signal review</strong>
                {strategyReview.map(item => <span key={item}>{item}</span>)}
              </div>
            )}
            {filteredSignalRows.length === 0 ? (
              <div className="signal-table-empty">No {signalFilter === 'ALL' ? 'combined BUY/SELL confirmation' : `${signalFilter.toLowerCase()} signal`} {dayFilter !== 'ALL' ? `for ${dayFilter}` : 'in this range'}.</div>
            ) : (
              <div className="signal-table-scroll">
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Buy/Sell Price</th>
                      <th>Current Price</th>
                      <th>Trade Cost</th>
                      <th>Candlestick</th>
                      <th>Chart pattern</th>
                      {selectedInterval === 'minute' && <th>1m Chart Structure</th>}
                      {selectedInterval === 'minute' && <th>3m Chart Structure</th>}
                      {selectedInterval === 'minute' && <th>5m Chart Structure</th>}
                      {selectedInterval === 'minute' && <th>1m EMA 10/20</th>}
                      <th>Entry</th>
                      <th>Target</th>
                      <th>Stop loss</th>
                      <th>Exit Price</th>
                      <th>Profit/Loss Points</th>
                      <th>Current P/L Points</th>
                      <th>Success</th>
                      <th>Evaluation</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignalRows.map((signal, index) => {
                      const parts = signal.pattern.split(' | ');
                      const tradeCost = tradeCostForSignal(signal);
                      // Find candle at signal time to get price at that moment
                      const signalCandle = candleData.find(candle => candle.x === signal.time);
                      const priceAtSignalTime = signalCandle?.c || signal.entry;
                      // Calculate P/L from entry to current price
                      const currentPLPoints = signal.action === 'BUY' 
                        ? priceAtSignalTime - signal.entry 
                        : signal.entry - priceAtSignalTime;
                      return (
                        <tr key={`${signal.time}-${index}`}>
                          <td>{new Date(signal.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span className={`signal-pill ${signal.action.toLowerCase()}`}>{signal.action}</span></td>
                          <td>₹{Number(signal.entry).toFixed(2)}</td>
                          <td className={priceAtSignalTime > signal.entry ? 'up' : priceAtSignalTime < signal.entry ? 'down' : ''}>₹{Number(priceAtSignalTime).toFixed(2)}</td>
                          <td>₹{tradeCost.totalCashRequired.toFixed(2)}<small>Premium ₹{tradeCost.notional.toFixed(2)} + fees ₹{tradeCost.totalCharges.toFixed(2)}</small></td>
                          <td>{parts[0].replace('Liquidity sweep + ', '').replace('Institutional ', '')}</td>
                          <td>{parts[1] || 'Confirmed structure'}</td>
                          {selectedInterval === 'minute' && <td>{signal.minuteConfirmation?.chart || 'No chart structure confirmation'}</td>}
                          {selectedInterval === 'minute' && <td>{signal.minuteConfirmation?.threeMinuteChart || 'No 3m chart structure confirmation'}</td>}
                          {selectedInterval === 'minute' && <td>{signal.minuteConfirmation?.fiveMinuteChart || 'No 5m chart structure confirmation'}</td>}
                          {selectedInterval === 'minute' && <td>{signal.minuteConfirmation?.emaStatus || 'EMA confirmation unavailable'}<small>{signal.minuteConfirmation?.ema || ''}</small></td>}
                          <td>₹{Number(signal.entry).toFixed(2)}</td>
                          <td>₹{Number(signal.target).toFixed(2)}{signal.levelSource && <small>{signal.levelSource}</small>}</td>
                          <td>₹{Number(signal.stopLoss).toFixed(2)}{signal.levelSource && <small>{signal.levelSource}</small>}</td>
                          <td>₹{Number(signal.outcome === 'True' ? signal.target : signal.outcome === 'False' ? signal.stopLoss : signal.entry).toFixed(2)}</td>
                          <td className={signal.outcome === 'Pending' ? '' : signal.outcome === 'True' ? 'profit' : 'loss'}>{(signal.action === 'BUY' ? (signal.outcome === 'True' ? signal.target - signal.entry : signal.outcome === 'False' ? signal.stopLoss - signal.entry : 0) : (signal.outcome === 'True' ? signal.entry - signal.target : signal.outcome === 'False' ? signal.entry - signal.stopLoss : 0)).toFixed(2)} pts</td>
                          <td className={currentPLPoints > 0 ? 'profit' : currentPLPoints < 0 ? 'loss' : ''}>{currentPLPoints.toFixed(2)} pts</td>
                          <td><span className={`outcome-pill ${signal.outcome.toLowerCase()}`}>{signal.outcome}</span></td>
                          <td>{signal.evaluation}</td>
                          <td>{signal.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>


        <div className="pcr-details">
          <h3>📊 Detailed Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-name">Put Volume</span>
              <span className="stat-value">{((pcrData?.put_volume || 0) / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Call Volume</span>
              <span className="stat-value">{((pcrData?.call_volume || 0) / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Put OI</span>
              <span className="stat-value">{((pcrData?.put_oi || 0) / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Call OI</span>
              <span className="stat-value">{((pcrData?.call_oi || 0) / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        </div>

        <div className="pcr-interpretation">
          <h3>💡 What is PCR?</h3>
          <p>
            The Put-Call Ratio (PCR) measures market sentiment by comparing Put and Call option volumes/open interest.
          </p>
          <ul>
            <li><strong>PCR &lt; 1.0:</strong> More calls than puts - Bullish sentiment</li>
            <li><strong>PCR = 1.0:</strong> Equal puts and calls - Neutral sentiment</li>
            <li><strong>PCR &gt; 1.0:</strong> More puts than calls - Bearish sentiment</li>
          </ul>
        </div>

        <div className="pcr-footer">
          <small>Last updated: {new Date().toLocaleTimeString()}</small>
        </div>
      </div>
    </div>
  );
}

export default PCRAnalysis;
