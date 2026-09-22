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
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { createChart, createSeriesMarkers, CandlestickSeries, LineSeries } from 'lightweight-charts';
import './PCRAnalysis.css';
import KiteAPI from '../services/kiteAPI';

ChartJS.register(
  LinearScale,
  TimeScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

const TIMEFRAME_OPTIONS = ['minute', '3minute', '5minute', '10minute', '15minute', '30minute', '60minute', 'day'];

function calculateEma(candles, period) {
  const multiplier = 2 / (period + 1);
  let ema = candles[0]?.c || 0;
  return candles.map((candle, index) => {
    ema = index === 0 ? candle.c : ((candle.c - ema) * multiplier) + ema;
    return { time: Math.floor(candle.x / 1000), value: ema };
  });
}

function calculateRsi(candles, period = 14) {
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
  const range = Math.max(current.h - current.l, 0.0001);
  const upperWick = current.h - Math.max(current.o, current.c);
  const lowerWick = Math.min(current.o, current.c) - current.l;
  const bullish = [];
  const bearish = [];
  const neutral = [];
  const isBull = current.c > current.o;
  const isBear = current.c < current.o;
  const smallBody = body <= range * 0.1;
  const previousRange = previous ? Math.max(previous.h - previous.l, 0.0001) : 0.0001;
  const previousBody = previous ? Math.abs(previous.c - previous.o) : 0;
  const previousDoji = previousBody <= previousRange * 0.1;
  const bullishEngulfing = isBull && previous.c < previous.o && current.o <= previous.c && current.c >= previous.o;
  const bearishEngulfing = isBear && previous.c > previous.o && current.o >= previous.c && current.c <= previous.o;

  if (smallBody) neutral.push('Doji');
  if (smallBody && lowerWick >= range * 0.6) bullish.push('Dragonfly doji');
  if (smallBody && upperWick >= range * 0.6) bearish.push('Gravestone doji');
  if (body <= range * 0.35 && upperWick >= body && lowerWick >= body) neutral.push('Spinning top');
  if (isBull && body >= range * 0.8) bullish.push('Bullish marubozu');
  if (isBear && body >= range * 0.8) bearish.push('Bearish marubozu');
  if (isBull && lowerWick >= body * 2 && upperWick <= range * 0.25) bullish.push('Hammer');
  if (isBull && upperWick >= body * 2 && lowerWick <= range * 0.25) bullish.push('Inverted hammer');
  if (isBear && lowerWick >= body * 2 && upperWick <= range * 0.25) bearish.push('Hanging man');
  if (isBear && upperWick >= body * 2 && lowerWick <= range * 0.25) bearish.push('Shooting star');
  if (bullishEngulfing) bullish.push('Bullish engulfing');
  if (bearishEngulfing) bearish.push('Bearish engulfing');
  if (previous.c < previous.o && isBull && current.o <= previous.c && current.c > (previous.o + previous.c) / 2) bullish.push('Piercing line');
  if (previous.c > previous.o && isBear && current.o >= previous.c && current.c < (previous.o + previous.c) / 2) bearish.push('Dark cloud cover');
  if (Math.abs(current.l - previous.l) / Math.max(previous.l, 0.0001) < 0.002 && isBull) bullish.push('Tweezer bottom');
  if (Math.abs(current.h - previous.h) / Math.max(previous.h, 0.0001) < 0.002 && isBear) bearish.push('Tweezer top');
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

function findChartPatterns(candles) {
  const recent = candles.slice(-40);
  const highs = recent.filter((candle, index) => index > 0 && index < recent.length - 1 && candle.h >= recent[index - 1].h && candle.h >= recent[index + 1].h);
  const lows = recent.filter((candle, index) => index > 0 && index < recent.length - 1 && candle.l <= recent[index - 1].l && candle.l <= recent[index + 1].l);
  const matchLevel = (items, field) => items.length >= 2 && Math.abs(items.at(-1)[field] - items.at(-2)[field]) / Math.max(items.at(-2)[field], 0.0001) < 0.01;
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

function calculateInstitutionalTradeSignal(candles) {
  if (candles.length < 12) {
    return { action: 'HOLD', pattern: 'Liquidity sweep not formed', reason: 'Not enough candles to confirm a valid sweep and order-block retest.' };
  }

  const recent = candles.slice(-30);
  const ema20 = calculateEma(candles, 20).at(-1)?.value || 0;
  const ema50 = calculateEma(candles, 50).at(-1)?.value || 0;
  const last = recent.at(-1);
  const previous = recent.at(-2);
  const priorSwingHigh = Math.max(...recent.slice(0, -1).map((candle) => candle.h));
  const priorSwingLow = Math.min(...recent.slice(0, -1).map((candle) => candle.l));

  const priorBearishCandles = recent.slice(-10).filter((candle) => candle.c < candle.o);
  const priorBullishCandles = recent.slice(-10).filter((candle) => candle.c > candle.o);

  const bullishOrderBlock = priorBearishCandles.length > 0
    ? {
        low: Math.min(...priorBearishCandles.map((candle) => candle.l)),
        high: Math.max(...priorBearishCandles.map((candle) => candle.h)),
        mid: priorBearishCandles.reduce((sum, candle) => sum + candle.c, 0) / priorBearishCandles.length,
      }
    : null;

  const bearishOrderBlock = priorBullishCandles.length > 0
    ? {
        low: Math.min(...priorBullishCandles.map((candle) => candle.l)),
        high: Math.max(...priorBullishCandles.map((candle) => candle.h)),
        mid: priorBullishCandles.reduce((sum, candle) => sum + candle.c, 0) / priorBullishCandles.length,
      }
    : null;

  const bullishSweep = last.h > priorSwingHigh * 1.001
    && last.c > previous.c
    && last.c > last.o
    && last.c > ema20
    && ema20 > ema50;

  const bearishSweep = last.l < priorSwingLow * 0.999
    && last.c < previous.c
    && last.c < last.o
    && last.c < ema20
    && ema20 < ema50;

  const bullishRetest = bullishSweep
    && bullishOrderBlock
    && last.c >= bullishOrderBlock.mid
    && last.l <= bullishOrderBlock.high * 1.005;

  const bearishRetest = bearishSweep
    && bearishOrderBlock
    && last.c <= bearishOrderBlock.mid
    && last.h >= bearishOrderBlock.low * 0.995;

  if (bullishRetest) {
    return {
      action: 'BUY',
      pattern: `Liquidity sweep + bullish order-block retest | Resistance ${priorSwingHigh.toFixed(2)} | OB ${bullishOrderBlock.low.toFixed(2)}-${bullishOrderBlock.high.toFixed(2)}`,
      reason: 'Price swept above prior resistance, then re-entered a bearish order block with bullish trend alignment and retest confirmation.',
    };
  }

  if (bearishRetest) {
    return {
      action: 'SELL',
      pattern: `Liquidity sweep + bearish order-block retest | Support ${priorSwingLow.toFixed(2)} | OB ${bearishOrderBlock.low.toFixed(2)}-${bearishOrderBlock.high.toFixed(2)}`,
      reason: 'Price swept below prior support, then re-entered a bullish order block with bearish trend alignment and retest confirmation.',
    };
  }

  return {
    action: 'HOLD',
    pattern: 'No valid sweep and retest confirmation',
    reason: 'The market has not yet produced a clean sweep, retest into the order block, and invalidation confirmation required for an institutional entry.',
  };
}

function calculateOneMinuteTradeSignal(candles, fiveMinuteCandles = []) {
  let institutionalSignal = calculateInstitutionalTradeSignal(candles);
  if (candles.length < 40 || fiveMinuteCandles.length < 20) {
    return {
      ...institutionalSignal,
      minuteConfirmation: { status: 'Need at least 40 one-minute and 20 five-minute candles for multi-timeframe confirmation.' },
    };
  }

  const window = candles.slice(-40);
  const candlestickPatterns = detectCandlestickPatterns(window, window.length - 1);
  const chartPatterns = classifyChartPatterns(findChartPatterns(window));
  const fiveMinuteChartPatterns = classifyChartPatterns(findChartPatterns(fiveMinuteCandles.slice(-40)));
  const ema10Series = calculateEma(candles, 10);
  const ema20Series = calculateEma(candles, 20);
  const ema10 = ema10Series.at(-1)?.value || 0;
  const ema20 = ema20Series.at(-1)?.value || 0;
  const previousEma10 = ema10Series.at(-2)?.value || 0;
  const previousEma20 = ema20Series.at(-2)?.value || 0;
  const lastClose = window.at(-1).c;
  const lastCandle = window.at(-1);
  const microStructure = window.slice(-16, -1);
  const microResistance = Math.max(...microStructure.map(candle => candle.h));
  const microSupport = Math.min(...microStructure.map(candle => candle.l));
  const crossedUp = previousEma10 <= previousEma20 && ema10 > ema20;
  const crossedDown = previousEma10 >= previousEma20 && ema10 < ema20;
  const emaStatus = crossedUp
    ? 'EMA10 crossed above EMA20 on the latest one-minute candle.'
    : crossedDown
      ? 'EMA10 crossed below EMA20 on the latest one-minute candle.'
      : ema10 > ema20
        ? 'EMA10 remains above EMA20; no fresh crossover on the latest candle.'
        : ema10 < ema20
          ? 'EMA10 remains below EMA20; no fresh crossover on the latest candle.'
          : 'EMA10 and EMA20 are equal.';
  const minuteConfirmation = {
    candlestick: `Bullish: ${candlestickPatterns.bullish.join(', ') || 'none'}; bearish: ${candlestickPatterns.bearish.join(', ') || 'none'}`,
    chart: `1m bullish: ${chartPatterns.bullish.join(', ') || 'none'}; bearish: ${chartPatterns.bearish.join(', ') || 'none'}`,
    fiveMinuteChart: `5m bullish: ${fiveMinuteChartPatterns.bullish.join(', ') || 'none'}; bearish: ${fiveMinuteChartPatterns.bearish.join(', ') || 'none'}`,
    ema: `EMA10 ₹${ema10.toFixed(2)} | EMA20 ₹${ema20.toFixed(2)} | Close ₹${lastClose.toFixed(2)}`,
    emaStatus,
  };

  if (!['BUY', 'SELL'].includes(institutionalSignal.action)) {
    const bullishContinuation = lastCandle.c > lastCandle.o && lastClose > microResistance * 1.0002 && ema10 > ema20 && lastClose > ema10;
    const bearishContinuation = lastCandle.c < lastCandle.o && lastClose < microSupport * 0.9998 && ema10 < ema20 && lastClose < ema10;
    if (bullishContinuation || bearishContinuation) {
      const action = bullishContinuation ? 'BUY' : 'SELL';
      institutionalSignal = {
        action,
        pattern: `One-minute momentum continuation | ${bullishContinuation ? 'Resistance' : 'Support'} ${(bullishContinuation ? microResistance : microSupport).toFixed(2)}`,
        reason: 'Price broke the recent one-minute structure with momentum and EMA 10/20 trend alignment.',
      };
    }
  }

  if (!['BUY', 'SELL'].includes(institutionalSignal.action)) {
    return { ...institutionalSignal, minuteConfirmation };
  }

  const isBuy = institutionalSignal.action === 'BUY';
  const alignedCandlestick = isBuy ? candlestickPatterns.bullish : candlestickPatterns.bearish;
  const alignedOneMinuteChart = isBuy ? chartPatterns.bullish : chartPatterns.bearish;
  const alignedFiveMinuteChart = isBuy ? fiveMinuteChartPatterns.bullish : fiveMinuteChartPatterns.bearish;
  const conflictingOneMinuteChart = isBuy ? chartPatterns.bearish : chartPatterns.bullish;
  const conflictingFiveMinuteChart = isBuy ? fiveMinuteChartPatterns.bearish : fiveMinuteChartPatterns.bullish;
  const emaAligned = isBuy
    ? ema10 > ema20 && lastClose > ema10
    : ema10 < ema20 && lastClose < ema10;

  const hasOneMinuteConfirmation = alignedCandlestick.length > 0 || alignedOneMinuteChart.length > 0;
  const unresolvedOneMinuteConflict = conflictingOneMinuteChart.length > 0 && alignedOneMinuteChart.length === 0;
  const unresolvedFiveMinuteConflict = conflictingFiveMinuteChart.length > 0 && alignedFiveMinuteChart.length === 0;
  if (!hasOneMinuteConfirmation || unresolvedOneMinuteConflict || unresolvedFiveMinuteConflict || !emaAligned) {
    return {
      action: 'HOLD',
      pattern: 'One-minute confirmation incomplete',
      reason: 'Requires an institutional or momentum continuation setup, an aligned one-minute candlestick or chart pattern, no unresolved opposite one-minute or five-minute structure, and EMA 10/20 alignment.',
      minuteConfirmation,
    };
  }

  return {
    ...institutionalSignal,
    pattern: `${institutionalSignal.pattern} | Candle ${alignedCandlestick.join(', ') || 'none'} | 1m Chart ${alignedOneMinuteChart.join(', ') || 'none'} | 5m Chart filter clear | EMA10 ${ema10.toFixed(2)} ${isBuy ? '>' : '<'} EMA20 ${ema20.toFixed(2)}`,
    reason: `${institutionalSignal.reason} One-minute candlestick or chart structure confirms with EMA 10/20 alignment; the five-minute chart has no conflicting structure.`,
    minuteConfirmation,
  };
}

function isBeforeThreePmIst(timestamp) {
  const indiaTime = new Date(new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return indiaTime.getHours() * 60 + indiaTime.getMinutes() < 15 * 60;
}

function calculateTradeSignal(candles, oneMinuteMode = false, fiveMinuteCandles = []) {
  const signal = oneMinuteMode ? calculateOneMinuteTradeSignal(candles, fiveMinuteCandles) : calculateInstitutionalTradeSignal(candles);
  if (['BUY', 'SELL'].includes(signal.action) && !isBeforeThreePmIst(candles.at(-1)?.x)) {
    return {
      action: 'HOLD',
      pattern: 'New entries disabled after 3:00 PM IST',
      reason: 'No new BUY or SELL signal is allowed after 3:00 PM IST. Existing positions must close using their target, stop loss, or intraday square-off.',
    };
  }
  return signal;
}

function calculateTradeLevels(candles, signal, oneMinuteMode = false) {
  const signalCandle = candles.at(-1);
  const recent = candles.slice(-20);
  const entry = signalCandle.c;
  const recentLow = Math.min(...recent.map(candle => candle.l));
  const recentHigh = Math.max(...recent.map(candle => candle.h));
  const averageRange = recent.reduce((sum, candle) => sum + (candle.h - candle.l), 0) / recent.length;
  const fallbackRisk = Math.max(averageRange * 1.2, 0.5);

  if (!oneMinuteMode || !signal.minuteConfirmation) {
    return signal.action === 'BUY'
      ? { entry, target: Math.max(recentHigh, entry + fallbackRisk * 2), stopLoss: recentLow - fallbackRisk }
      : { entry, target: Math.min(recentLow, entry - fallbackRisk * 2), stopLoss: recentHigh + fallbackRisk };
  }

  const structure = candles.slice(-40);
  const pivotHighs = structure.filter((candle, index) => index > 0 && index < structure.length - 1
    && candle.h >= structure[index - 1].h && candle.h >= structure[index + 1].h);
  const pivotLows = structure.filter((candle, index) => index > 0 && index < structure.length - 1
    && candle.l <= structure[index - 1].l && candle.l <= structure[index + 1].l);
  const patternRange = Math.max(...structure.map(candle => candle.h)) - Math.min(...structure.map(candle => candle.l));
  const buffer = Math.max(averageRange * 0.35, 0.5);

  if (signal.action === 'BUY') {
    const patternSupport = pivotLows.at(-1)?.l ?? recentLow;
    const stopLoss = patternSupport - buffer;
    const risk = entry - stopLoss;
    const target = entry + Math.max(patternRange, risk * 2);
    return { entry, target, stopLoss, levelSource: '1m pattern support and measured move' };
  }

  const patternResistance = pivotHighs.at(-1)?.h ?? recentHigh;
  const stopLoss = patternResistance + buffer;
  const risk = stopLoss - entry;
  const target = entry - Math.max(patternRange, risk * 2);
  return { entry, target, stopLoss, levelSource: '1m pattern resistance and measured move' };
}

function calculateCurrentTradePlan(candles, signal) {
  if (!signal || !['BUY', 'SELL'].includes(signal.action) || candles.length === 0) return null;
  return { ...signal, time: candles.at(-1).x, ...calculateTradeLevels(candles, signal, Boolean(signal.minuteConfirmation)) };
}

function evaluateSignalWithFutureCandles(signal, future, target, stopLoss) {
  if (future.length === 0) {
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
  return {
    outcome: 'Pending',
    evaluation: `Checked ${future.length} future candle${future.length === 1 ? '' : 's'}; target/stop not touched yet`,
  };
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

function buildSignalRows(candles, oneMinuteMode = false, fiveMinuteCandles = []) {
  let activeTradeUntil = 0;
  return candles
    .map((_, index) => {
      if (index < 10) return null;
      if (candles[index].x <= activeTradeUntil) return null;
      if (!isBeforeThreePmIst(candles[index].x)) return null;
      const window = candles.slice(0, index + 1).slice(-40);
      const fiveMinuteWindow = fiveMinuteCandles.filter(candle => candle.x <= candles[index].x).slice(-40);
      const signal = calculateTradeSignal(window, oneMinuteMode, fiveMinuteWindow);
      if (signal.action === 'HOLD') return null;

      const signalCandle = candles[index];
      const levels = calculateTradeLevels(window, signal, oneMinuteMode);
      const { entry, target, stopLoss } = levels;

      if (signal.action === 'BUY') {
        const future = candles.slice(index + 1);
        const result = evaluateSignalWithFutureCandles(signal, future, target, stopLoss);
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

      const future = candles.slice(index + 1);
      const result = evaluateSignalWithFutureCandles(signal, future, target, stopLoss);
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

function PCRAnalysis({ apiKey }) {
  const [pcrData, setPcrData] = useState(null);
  const [nifty50Data, setNifty50Data] = useState(null);
  const [strikeOptions, setStrikeOptions] = useState([]);
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState('5minute');
  const [candleData, setCandleData] = useState([]);
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
  const [signalFilter, setSignalFilter] = useState('ALL');
  const candleChartRef = React.useRef(null);
  const [latestCandle, setLatestCandle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPCRData();
  }, [apiKey]);

  useEffect(() => {
    if (!selectedStrike || !selectedInterval) return;
    fetchHistoricalChart(selectedStrike, selectedInterval);
    fetchRealPCR(selectedStrike);

    const refreshInterval = setInterval(() => {
      fetchHistoricalChart(selectedStrike, selectedInterval);
      fetchRealPCR(selectedStrike);
    }, 50000);

    return () => clearInterval(refreshInterval);
  }, [selectedStrike, selectedInterval]);

  const fetchRealPCR = async (strike) => {
    if (!strike?.instrumentToken) return;
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
      console.error('Real PCR fetch failed:', err);
      setError(err.message || 'Unable to compute live PCR.');
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
      from.setDate(from.getDate() - 30);
      const candles = await kiteAPI.getHistoricalData({
        instrumentToken: strike.instrumentToken,
        interval,
        from: formatDateTime(from, '09:15:00'),
        to: formatDateTime(to, '23:59:59'),
      });

      const normalized = Array.isArray(candles) ? candles : [];
      const toCandleData = (rawCandles) => rawCandles.map((item) => {
        const timestamp = Array.isArray(item) ? item[0] : item?.timestamp;
        const dateValue = new Date(timestamp).getTime();
        return {
          x: dateValue,
          o: Number(Array.isArray(item) ? item[1] : item?.open),
          h: Number(Array.isArray(item) ? item[2] : item?.high),
          l: Number(Array.isArray(item) ? item[3] : item?.low),
          c: Number(Array.isArray(item) ? item[4] : item?.close),
        };
      }).filter(candle => Number.isFinite(candle.x)
        && Number.isFinite(candle.o)
        && Number.isFinite(candle.h)
        && Number.isFinite(candle.l)
        && Number.isFinite(candle.c));
      const candleData = toCandleData(normalized);
      const decisionCandleData = candleData;
      const oneMinuteMode = interval === 'minute';
      let fiveMinuteCandleData = [];

      if (oneMinuteMode) {
        const fiveMinuteCandles = await kiteAPI.getHistoricalData({
          instrumentToken: strike.instrumentToken,
          interval: '5minute',
          from: formatDateTime(from, '09:15:00'),
          to: formatDateTime(to, '23:59:59'),
        });
        fiveMinuteCandleData = toCandleData(Array.isArray(fiveMinuteCandles) ? fiveMinuteCandles : []);
      }

      const latest = normalized[normalized.length - 1];
      setLatestCandle(
        Array.isArray(latest)
          ? { open: latest[1], high: latest[2], low: latest[3], close: latest[4], volume: latest[5], oi: latest[6] }
          : latest || null
      );

        const currentSignal = calculateTradeSignal(decisionCandleData, oneMinuteMode, fiveMinuteCandleData);
        setCandleData(candleData);
        setTradeSignal(currentSignal);
        setAutoTradePlan(calculateCurrentTradePlan(decisionCandleData, currentSignal));
        setSignalRows(buildSignalRows(decisionCandleData, oneMinuteMode, fiveMinuteCandleData));
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
      setError(err.message);
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
      setAutoTradingStatus(`Submitting ${autoTradePlan.action} order with target and stop loss...`);
      try {
        const kiteAPI = new KiteAPI();
        const order = await kiteAPI.submitAutomaticSignal({
          action: autoTradePlan.action,
          exchange: 'NFO',
          tradingsymbol: selectedStrike.tradingsymbol,
          quantity: Number(selectedStrike.lotSize) || 1,
          entry: autoTradePlan.entry,
          target: autoTradePlan.target,
          stopLoss: autoTradePlan.stopLoss,
          signalTime: autoTradePlan.time,
        });
        if (!cancelled) setAutoTradingStatus(`Entry submitted: ${order.entryOrderId}. Target and stop-loss exits will be armed after it fills.`);
      } catch (err) {
        if (!cancelled) setAutoTradingStatus(err.response?.data?.error || err.message || 'Automatic order was rejected.');
      }
    };
    submitSignal();
    return () => { cancelled = true; };
  }, [autoTradePlan, autoTradingEnabled, selectedStrike, submittedAutoSignalKey]);

  useEffect(() => {
    const container = candleChartRef.current;
    if (!container || candleData.length === 0) return undefined;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 360,
      layout: { background: { color: '#ffffff' }, textColor: '#475569' },
      grid: {
        vertLines: { color: '#eef2f7' },
        horzLines: { color: '#eef2f7' },
      },
      rightPriceScale: {
        borderColor: '#cbd5e1',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#cbd5e1',
        timeVisible: selectedInterval !== 'day',
        secondsVisible: false,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#15803d',
      downColor: '#dc2626',
      borderVisible: false,
      wickUpColor: '#15803d',
      wickDownColor: '#dc2626',
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    });
    series.setData(candleData.map(candle => ({
      time: Math.floor(candle.x / 1000),
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
    })));
    const ema10 = chart.addSeries(LineSeries, { color: '#fbbf24', lineWidth: 2, title: 'EMA 10', priceLineVisible: false });
    const ema20 = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, title: 'EMA 20', priceLineVisible: false });
    ema10.setData(calculateEma(candleData, 10));
    ema20.setData(calculateEma(candleData, 20));
    const markers = [];
    candleData.forEach((candle, index) => {
      if (index < 1) return;
      const window = candleData.slice(Math.max(0, index - 49), index + 1);
      const candlePatterns = detectCandlestickPatterns(window, window.length - 1);
      const chartPatterns = findChartPatterns(window);
      const chartDirection = classifyChartPatterns(chartPatterns);
      const shortAverage = window.slice(-3).reduce((sum, item) => sum + item.c, 0) / Math.min(window.length, 3);
      const longAverage = window.reduce((sum, item) => sum + item.c, 0) / window.length;
      const trendUp = shortAverage > longAverage && candle.c > window[window.length - 2].c;
      const trendDown = shortAverage < longAverage && candle.c < window[window.length - 2].c;
      const market = getMarketConfirmations(window);
      if (candlePatterns.bullish.length > 0 && chartDirection.bullish.length > 0 && trendUp && market.bullish) {
        const text = `BUY | Candle: ${candlePatterns.bullish.join(', ')} | Chart: ${chartDirection.bullish.join(', ')} | EMA20 > EMA50 | RSI14 ${market.rsi.toFixed(1)} | All confirmed`;
        markers.push({ time: Math.floor(candle.x / 1000), position: 'belowBar', color: '#15803d', shape: 'arrowUp', text });
      } else if (candlePatterns.bearish.length > 0 && chartDirection.bearish.length > 0 && trendDown && market.bearish) {
        const text = `SELL | Candle: ${candlePatterns.bearish.join(', ')} | Chart: ${chartDirection.bearish.join(', ')} | EMA20 < EMA50 | RSI14 ${market.rsi.toFixed(1)} | All confirmed`;
        markers.push({ time: Math.floor(candle.x / 1000), position: 'aboveBar', color: '#dc2626', shape: 'arrowDown', text });
      }
    });
    const markerSeries = createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (!container.isConnected || container.clientWidth === 0) return;
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      markerSeries.detach();
      chart.remove();
    };
  }, [candleData, selectedInterval]);

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
      if (strikes.length > 0) {
        const niftyQuote = Number(niftyIndex.last_price || 0);
        const nearest = strikes.reduce((best, current) => {
          const diffCurrent = Math.abs(current.strike - niftyQuote);
          const diffBest = Math.abs(best.strike - niftyQuote);
          return diffCurrent < diffBest ? current : best;
        }, strikes[0]);
        setSelectedStrike(nearest);
      }
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
  const filteredSignalRows = signalFilter === 'ALL'
    ? signalRows
    : signalRows.filter(signal => signal.action === signalFilter);
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
              Strike
              <select
                value={selectedStrike ? selectedStrike.instrumentToken : ''}
                onChange={(event) => {
                  const match = strikeOptions.find(option => String(option.instrumentToken) === event.target.value);
                  setSelectedStrike(match || null);
                }}
                disabled={strikeOptions.length === 0}
              >
                {strikeOptions.length === 0 ? <option value="">Loading strikes...</option> : strikeOptions.map((option) => (
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
          </div>

          {latestCandle && (
            <div className="ohlc-summary">
              <div className="ohlc-box"><span>Open</span><strong>₹{Number(latestCandle.open || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>High</span><strong>₹{Number(latestCandle.high || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Low</span><strong>₹{Number(latestCandle.low || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Close</span><strong>₹{Number(latestCandle.close || 0).toFixed(2)}</strong></div>
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
                  <span>{tradeSignal.minuteConfirmation.fiveMinuteChart}</span>
                  <span>{tradeSignal.minuteConfirmation.ema}</span>
                  <span>{tradeSignal.minuteConfirmation.emaStatus || tradeSignal.minuteConfirmation.status}</span>
                </div>
              )}
            </div>
          </div>

          <section className={`auto-trading-panel ${autoTradingEnabled ? 'armed' : ''}`}>
            <div>
              <h4>Automatic Trading</h4>
              <span>{autoTradingStatus}</span>
            </div>
            <label className="auto-trading-acknowledgement">
              <input
                type="checkbox"
                checked={autoTradingAcknowledged}
                onChange={(event) => setAutoTradingAcknowledged(event.target.checked)}
                disabled={autoTradingEnabled || autoTradingBusy}
              />
              I understand this places live Kite orders for one lot with a target and stop loss.
            </label>
            {autoTradePlan && <div className="auto-trade-levels">Next signal: {autoTradePlan.action} | Entry ₹{autoTradePlan.entry.toFixed(2)} | Target ₹{autoTradePlan.target.toFixed(2)} | Stop ₹{autoTradePlan.stopLoss.toFixed(2)}</div>}
            <button
              type="button"
              className={autoTradingEnabled ? 'auto-trading-stop' : 'auto-trading-start'}
              onClick={autoTradingEnabled ? stopAutomaticTrading : startAutomaticTrading}
              disabled={autoTradingBusy || (!autoTradingEnabled && !autoTradingAcknowledged)}
            >
              {autoTradingBusy ? 'Working...' : autoTradingEnabled ? 'Stop Automatic Trading' : 'Start Automatic Trading'}
            </button>
          </section>

          {chartLoading ? (
            <div className="chart-loading">Loading chart...</div>
          ) : candleData.length > 0 ? (
            <div className="chart-stack">
              <section className="chart-block">
                <h4>OHLC Candlesticks <span className="chart-legend"><i className="legend-candle" /> Candle <i className="legend-ema20" /> EMA10 <i className="legend-ema50" /> EMA20</span></h4>
                <div ref={candleChartRef} className="chart-wrapper" />
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
                <button type="button" className="download-signals-btn" onClick={downloadSignalsJson} disabled={filteredSignalRows.length === 0}>Download JSON</button>
              </div>
              <div className="signal-summary">
                <span>{filteredSignalRows.length} decisions | Overall success: {overallSuccess.toFixed(1)}%</span>
                {latestTradeCost && <span>Latest one-trade cost: ₹{latestTradeCost.totalCashRequired.toFixed(2)} (Premium ₹{latestTradeCost.notional.toFixed(2)} + charges ₹{latestTradeCost.totalCharges.toFixed(2)})</span>}
                <span>Win amount: {winAmountPercent.toFixed(1)}% | Completed investment: ₹{realizedInvestment.toFixed(2)}</span>
                <span>Gross P/L: <b className={realizedProfitLoss >= 0 ? 'profit' : 'loss'}>{realizedProfitLoss >= 0 ? '+' : ''}₹{realizedProfitLoss.toFixed(2)}</b> | Pending investment: ₹{pendingInvestment.toFixed(2)} | Lot size: {lotSize}</span>
              </div>
            </div>
            {strategyReview.length > 0 && (
              <div className="strategy-review">
                <strong>Failed signal review</strong>
                {strategyReview.map(item => <span key={item}>{item}</span>)}
              </div>
            )}
            {filteredSignalRows.length === 0 ? (
              <div className="signal-table-empty">No {signalFilter === 'ALL' ? 'combined BUY/SELL confirmation' : `${signalFilter.toLowerCase()} signal`} in this range.</div>
            ) : (
              <div className="signal-table-scroll">
                <table className="signal-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Buy/Sell Price</th>
                      <th>Trade Cost</th>
                      <th>Candlestick</th>
                      <th>Chart pattern</th>
                      {selectedInterval === 'minute' && <th>1m Chart Structure</th>}
                      {selectedInterval === 'minute' && <th>5m Chart Structure</th>}
                      {selectedInterval === 'minute' && <th>1m EMA 10/20</th>}
                      <th>Entry</th>
                      <th>Target</th>
                      <th>Stop loss</th>
                      <th>Success</th>
                      <th>Evaluation</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignalRows.map((signal, index) => {
                      const parts = signal.pattern.split(' | ');
                      const tradeCost = tradeCostForSignal(signal);
                      return (
                        <tr key={`${signal.time}-${index}`}>
                          <td>{new Date(signal.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span className={`signal-pill ${signal.action.toLowerCase()}`}>{signal.action}</span></td>
                          <td>₹{Number(signal.entry).toFixed(2)}</td>
                          <td>₹{tradeCost.totalCashRequired.toFixed(2)}<small>Premium ₹{tradeCost.notional.toFixed(2)} + fees ₹{tradeCost.totalCharges.toFixed(2)}</small></td>
                          <td>{parts[0].replace('Liquidity sweep + ', '').replace('Institutional ', '')}</td>
                          <td>{parts[1] || 'Confirmed structure'}</td>
                          {selectedInterval === 'minute' && <td>{signal.minuteConfirmation?.chart || 'No chart structure confirmation'}</td>}
                          {selectedInterval === 'minute' && <td>{signal.minuteConfirmation?.fiveMinuteChart || 'No 5m chart structure confirmation'}</td>}
                          {selectedInterval === 'minute' && <td>{signal.minuteConfirmation?.emaStatus || 'EMA confirmation unavailable'}<small>{signal.minuteConfirmation?.ema || ''}</small></td>}
                          <td>₹{Number(signal.entry).toFixed(2)}</td>
                          <td>₹{Number(signal.target).toFixed(2)}{signal.levelSource && <small>{signal.levelSource}</small>}</td>
                          <td>₹{Number(signal.stopLoss).toFixed(2)}{signal.levelSource && <small>{signal.levelSource}</small>}</td>
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
