# Live Trading Signal Architecture

## Overview
Yes, exactly! Your application works as follows:

### 1. **Real-Time Candle Updates (Every Tick)**
- **Source**: Live price ticks from Kite API websocket
- **Frequency**: On every price tick received
- **What happens**:
  - Current candle's OHLC (Open, High, Low, Close) is updated
  - High: `Math.max(candle.h, livePrice)` - tracks highest price in candle
  - Low: `Math.min(candle.l, livePrice)` - tracks lowest price in candle
  - Close: `livePrice` - current market price
  - Chart is redrawn with updated candle data

**Code Reference**: `useEffect` with `[livePrice, candleData, selectedInterval]` dependency

---

### 2. **1-Minute Candle Boundary Detection**
- **Trigger**: When time crosses to the next 60-second boundary
- **Check**: Compares current time with last candle timestamp
- **Action**: When a new candle period is detected:
  ```javascript
  const currentCandleBoundary = Math.floor(currentTime / intervalSeconds) * intervalSeconds;
  if (currentCandleBoundary >= lastCandleTime) {
    // New candle period detected - proceed to step 3
  }
  ```

---

### 3. **Signal Generation on New Candle**
When a new 1-minute candle is detected:

1. **Updated Candle Data** is created with live price incorporated into the last candle
2. **calculateTradeSignal()** is called with updated candles
   - Analyzes 20 candles by default (configurable)
   - Checks for: Liquidity sweeps, institutional patterns, chart structure
   - Returns: BUY, SELL, or HOLD signal
3. **Trade levels are calculated**:
   - Entry price
   - Target price (profit level)
   - Stop Loss price (risk level)
4. **Signal is added to table** with status = "Pending"

**Code Location**: `buildSignalRows()` function (line ~843)

---

### 4. **Target & Stop Loss Hit Detection (Real-Time Ticks)**
Once a signal is generated with Target and Stop Loss levels:

#### **Every incoming live tick**:
```javascript
// For each future candle after the signal candle:
const hitStop = signal.action === 'BUY' ? candle.l <= stopLoss : candle.h >= stopLoss;
const hitTarget = signal.action === 'BUY' ? candle.h >= target : candle.l <= target;
```

#### **For BUY signals**:
- ✅ **Target HIT**: If candle HIGH ≥ target price
  - Outcome: **"True"** (Profit) ✓
  - Status updates to "Profit" with green highlight
  
- ❌ **Stop Loss HIT**: If candle LOW ≤ stop loss price
  - Outcome: **"False"** (Loss) ✗
  - Status updates to "Loss" with red highlight

#### **For SELL signals** (opposite logic):
- ✅ **Target HIT**: If candle LOW ≤ target price
  - Outcome: **"True"** (Profit) ✓
  
- ❌ **Stop Loss HIT**: If candle HIGH ≥ stop loss price
  - Outcome: **"False"** (Loss) ✗

#### **Priority logic**:
1. If both target AND stop hit in same candle: Marked as "Ambiguous"
2. Target hit first: Signal outcome = "True" (profit)
3. Stop hit first: Signal outcome = "False" (loss)
4. Neither hit yet: Signal outcome = "Pending" (still open)

**Code Location**: `evaluateSignalWithFutureCandles()` function (line ~656)

---

## Timeline Example

### **14:35:00 (1-min candle closes)**
- New candle starts for 14:35-14:36 period
- Signal is generated: BUY at ₹20000
  - Target: ₹20100 (profit zone)
  - Stop Loss: ₹19950 (risk zone)
- Signal added to table with status = "Pending"

### **14:35:15 (live tick)**
- Price: ₹20050
- Candle updates: High ₹20050, Low ₹19990, Close ₹20050
- Check: 20050 < 20100 and 19990 > 19950 → Still pending

### **14:35:32 (live tick - TARGET HIT)**
- Price: ₹20105
- Candle updates: High ₹20105
- Check: 20105 ≥ 20100 → **TARGET HIT!**
- Signal outcome changes to: **"True"** ✓
- Evaluation: "high ₹20105 reached target"
- Status: **Profit** (green)

---

## Multi-Timeframe Support

### **Current Implementation**:
- **1-Minute Mode**: 
  - Checks target/SL on intraday candles only (same trading day)
  - Stops checking at 3 PM IST (market close)
  - Uses candle HIGH/LOW for exact hit detection
  
- **5-Minute/1-Hour Modes** (limited support):
  - Only 1-minute candles are fetched and used
  - 5-minute and 3-minute candles are empty arrays
  - Signals use 1-minute data only

---

## Real-Time vs Periodic Updates

### **❌ NOT Periodic**:
No periodic refresh timers for signal recalculation. This avoids redundant calculations and ensures signals update only when:
1. Live price changes (tick-based)
2. New candle boundary is crossed (1-min boundary)

### **✅ Real-Time**:
- Every tick updates the current candle OHLC
- Signals recalculate with updated candle data
- Target/SL hits are detected immediately on any tick
- No delay or missed ticks

---

## Key Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `calculateTradeSignal()` | Generates BUY/SELL/HOLD signals | Candle data | Signal object with action & reason |
| `calculateTradeLevels()` | Calculates target & stop loss | Signal + candles | Entry, Target, StopLoss prices |
| `evaluateSignalWithFutureCandles()` | Checks if target/SL hit | Signal + future candles | Outcome (True/False/Pending) |
| `buildSignalRows()` | Creates signal table rows | All candles | Array of historical signals |

---

## Current Limitations

1. **Only 1-minute candles used**: 5-minute and 3-minute data are not fetched
   - All signals currently use 1-minute OHLC only
   
2. **No tick-level precision**: 
   - Uses candle HIGH/LOW for hit detection
   - Cannot detect if price touched level at exact tick between candles
   
3. **Session-based**:
   - Resets daily at 3:30 PM IST
   - New signals only generated before 3 PM
   
4. **Post-trade analysis**:
   - All outcomes are determined using historical candles
   - Live signals update to "Pending" status as new candles come in

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    LIVE PRICE TICK                          │
│                  (Kite Websocket)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Update Current Candle     │
        │  High/Low/Close/Volume     │
        │  (with live price)         │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Check Candle Boundary     │
        │  Time % 60 seconds         │
        └───┬────────────────────┬───┘
            │                    │
       NO   │                    │ YES (New 1-min candle)
            │                    │
            ▼                    ▼
   ┌──────────────────┐  ┌──────────────────────┐
   │ Check Target/SL  │  │ Generate New Signal  │
   │ Hit Detection    │  │ (calculateTradeSignal)
   │                  │  │                      │
   │ High ≥ Target?  │  │ Entry, Target, SL    │
   │ Low ≤ SL?        │  │ Added to table       │
   │                  │  │ Status: Pending      │
   └─────────┬────────┘  └──────────┬──────────┘
             │                      │
             ▼                      ▼
   ┌──────────────────┐  ┌──────────────────────┐
   │ Update Signal    │  │ Recalculate with     │
   │ Status           │  │ new candle data      │
   │                  │  │                      │
   │ True (Profit) ✓  │  │ Check T/SL again     │
   │ False (Loss) ✗   │  │                      │
   │ Pending (Open)   │  │ Update chart         │
   └──────────────────┘  └──────────────────────┘
```

---

## Configuration

| Constant | Value | Purpose |
|----------|-------|---------|
| `DEFAULT_CANDLES` | 20 | Number of candles analyzed for signal |
| `MARKET_CHECK_INTERVAL` | 30000ms | Market open/close status check |
| `TIMEFRAME_SECONDS['minute']` | 60 | 1-minute candle boundary |
| Session close | 3 PM IST | Daily trading cutoff time |

---

## Future Improvements

1. **Fetch 5-minute & 3-minute candles**: Enable multi-timeframe confirmation
2. **Tick-level precision**: Store minute ticks for exact hit detection
3. **Order management**: Send actual buy/sell orders to broker
4. **Position tracking**: Link signals to broker positions for real P&L
5. **Risk management**: Dynamically adjust stops based on volatility (ATR)
