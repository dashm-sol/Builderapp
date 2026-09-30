import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts';

/**
 * CandlestickChart Component
 * 
 * Handles OHLC candlestick chart rendering with EMA indicators
 * 
 * Props:
 * - candleData: Array of candle objects {x, o, h, l, c}
 * - ema10Data: Array of EMA-10 points {time, value}
 * - ema20Data: Array of EMA-20 points {time, value}
 * - selectedInterval: Current timeframe (minute, 5-minute, etc.)
 * - livePrice: Current live price for real-time updates
 * - onChartRef: Callback to provide chart series refs to parent
 */

function CandlestickChart({
  candleData,
  ema10Data,
  ema20Data,
  selectedInterval,
  livePrice,
  onChartRef,
}) {
  const candleChartRef = useRef(null);
  const chartSeriesRef = useRef(null);
  const ema10SeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const lastCandleOpenRef = useRef(null);
  const currentCandleBoundaryRef = useRef(null);
  const currentCandleDataRef = useRef({ time: null, open: null, high: null, low: null, close: null });

  // Initialize chart on mount
  useEffect(() => {
    if (!candleChartRef.current || candleData.length === 0) return;

    const container = candleChartRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 480,
      layout: { background: { color: '#ffffff' }, textColor: '#334155' },
      grid: {
        vertLines: { color: '#f0f3f7', style: 1 },
        horzLines: { color: '#f0f3f7', style: 1 },
      },
      rightPriceScale: {
        borderColor: '#d1d5db',
        textColor: '#334155',
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: '#d1d5db',
        textColor: '#334155',
        timeVisible: selectedInterval !== 'day',
        secondsVisible: false,
        tickMarkFormatter: (time) => {
          const timestamp = typeof time === 'number' ? time * 1000 : Date.UTC(time.year, time.month - 1, time.day);
          return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }).format(timestamp);
        },
      },
    });

    // Add candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: true,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    });
    chartSeriesRef.current = candleSeries;

    // Set initial candle data
    candleSeries.setData(
      candleData.map(candle => ({
        time: Math.floor(candle.x / 1000),
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
      }))
    );

    // Initialize candle tracking
    lastCandleOpenRef.current = candleData[candleData.length - 1]?.o || null;
    const lastCandleTime = Math.floor((candleData[candleData.length - 1]?.x || Date.now()) / 1000);
    
    const getIntervalSeconds = (interval) => {
      const map = { minute: 60, '3-minute': 180, '5-minute': 300, '15-minute': 900, hour: 3600, day: 86400 };
      return map[interval] || 60;
    };
    const getCandleBoundary = (timestamp, intervalSeconds) => {
      return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
    };
    
    const intervalSeconds = getIntervalSeconds(selectedInterval);
    const currentTime = Math.floor(Date.now() / 1000);
    currentCandleBoundaryRef.current = getCandleBoundary(currentTime, intervalSeconds);

    // Add EMA lines
    const ema10Series = chart.addSeries(LineSeries, {
      color: '#fbbf24',
      lineWidth: 2,
      title: 'EMA 10',
      priceFormat: { type: 'price', precision: 2 },
    });
    ema10SeriesRef.current = ema10Series;
    if (ema10Data && ema10Data.length > 0) {
      ema10Series.setData(ema10Data);
    }

    const ema20Series = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 2,
      title: 'EMA 20',
      priceFormat: { type: 'price', precision: 2 },
    });
    ema20SeriesRef.current = ema20Series;
    if (ema20Data && ema20Data.length > 0) {
      ema20Series.setData(ema20Data);
    }

    // Fit content
    chart.timeScale().fitContent();

    // Notify parent of refs
    onChartRef({
      chartSeriesRef,
      ema10SeriesRef,
      ema20SeriesRef,
      lastCandleOpenRef,
      currentCandleBoundaryRef,
      currentCandleDataRef,
    });

    // Cleanup
    return () => {
      chart.remove();
    };
  }, [candleData, selectedInterval]);

  // Update EMA data when it changes
  useEffect(() => {
    if (ema10SeriesRef.current && ema10Data && ema10Data.length > 0) {
      ema10SeriesRef.current.setData(ema10Data);
    }
  }, [ema10Data]);

  useEffect(() => {
    if (ema20SeriesRef.current && ema20Data && ema20Data.length > 0) {
      ema20SeriesRef.current.setData(ema20Data);
    }
  }, [ema20Data]);

  return (
    <div
      ref={candleChartRef}
      style={{
        width: '100%',
        height: '480px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
      }}
    />
  );
}

export default CandlestickChart;
