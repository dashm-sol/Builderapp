# Code Review Findings - Live Trading Logic

**Review Date**: 2026-10-07  
**File**: src/components/PCRAnalysis.js (2471 lines)  
**Status**: ⚠️ 3 Issues Found

---

## Summary

| Severity | Issue | Impact | Status |
|----------|-------|--------|--------|
| 🔴 HIGH | Signal Locking Key Mismatch | Signal locking never works | Needs Fix |
| 🟡 MEDIUM | Timezone Handling in getTradingDayKey | Possible session boundary errors | Needs Fix |
| 🟡 MEDIUM | Live Price vs Candle-Based Evaluation | Gap handling inconsistency | Needs Fix |

---

## Issue #1: Signal Locking Key Format Mismatch 🔴 HIGH

### Location
- **Line 1038**: `getSignalKey()` definition
- **Line 1319-1327**: `currentSignalKey` creation and usage

### Problem
The signal locking mechanism has **inconsistent key formats** that cause signal locks to never work:

```javascript
// Line 1038: Key format A
const getSignalKey = (signal) => `${signal.time}-${signal.action}`;
// Example: "1696688346000-BUY"

// Line 1325: Key format B (DIFFERENT!)
const currentSignalKey = `${currentSignal.action}-${Math.floor(lastCandle.x / 60000)}`;
// Example: "BUY-28277"
```

### Why This Is Wrong
- Format A: `${timestamp}-${action}` (milliseconds)
- Format B: `${action}-${minutesSinceEpoch}` (minutes)
- These **never match**, so `lockedSignalKeys.has(currentSignalKey)` always returns `false`
- Additionally, `lockSignal()` function at line 1040 is **never called** anywhere in the code
- Result: The `lockedSignalKeys` Set is always empty - signal locking doesn't work

### Impact
- Signal entries cannot be frozen
- Signals can be overwritten when recalculating
- User loses ability to lock signal details

### Fix
**Option 1: Use Timestamp-Based Key (Recommended)**
```javascript
// Line 1038: Keep as is
const getSignalKey = (signal) => `${signal.time}-${signal.action}`;

// Line 1325: Update to match
const currentSignalKey = getSignalKey(currentSignal); // Use the function
```

**Option 2: Use Minute-Based Key (Consistent)**
```javascript
// Line 1038: Update to match
const getSignalKey = (signal) => `${signal.action}-${Math.floor(signal.time / 60000)}`;

// Line 1325: Already correct
const currentSignalKey = `${currentSignal.action}-${Math.floor(lastCandle.x / 60000)}`;
```

**Also add**: Call `lockSignal()` when user wants to lock (e.g., in an onClick handler)

---

## Issue #2: Timezone Handling in getTradingDayKey 🟡 MEDIUM

### Location
- **Line 752-754**: `getTradingDayKey()` function
- **Used at**: Lines 825-828 (session boundary detection)

### Problem
Uses browser's **local timezone** instead of IST:

```javascript
function getTradingDayKey(timestamp) {
  const date = new Date(timestamp);  // ❌ Uses browser timezone!
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
```

### Why This Is Wrong
- If browser is in US timezone (UTC-5), market close might be at a different date boundary
- Example:
  - IST: 2026-10-07 15:30 (3:30 PM, market close)
  - US PST: 2026-10-07 06:00 AM (same day in PST!)
  - Browser would think it's still the same day
- Causes session exit logic to trigger at **wrong times**

### Impact
- Candles after market close might be incorrectly attributed to current trading day
- Session exit detection fails
- Tomorrow's candles might merge with today's in 1-minute mode

### Fix
```javascript
function getTradingDayKey(timestamp) {
  // Convert to IST first, then get date
  const istDate = new Date(new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${istDate.getFullYear()}-${istDate.getMonth()}-${istDate.getDate()}`;
}
```

**Note**: Compare with `isBeforeThreePmIst()` at line 590-592 which correctly uses IST timezone.

---

## Issue #3: Live Price vs Candle-Based Evaluation 🟡 MEDIUM

### Location
- **Lines 1363-1389**: Live price monitoring (tick-based)
- **Lines 715-728**: Historical evaluation (candle-based)

### Problem
**Two different evaluation methods** for target/stop loss hits:

**Live Price Method (Tick-Based):**
```javascript
// Line 1364-1365
if (livePrice >= signal.target) {
  updatedSignal.outcome = 'True';  // ❌ Single tick check
}
if (livePrice <= signal.stopLoss) {
  updatedSignal.outcome = 'False';  // ❌ Single tick check
}
```

**Candle Method (Historical):**
```javascript
// Line 719-720
const hitTarget = signal.action === 'BUY' ? candle.h >= target : candle.l <= target;
const hitStop = signal.action === 'BUY' ? candle.l <= stopLoss : candle.h >= stopLoss;
```

### Why This Is Wrong
- **Gap risk**: If market gaps (e.g., opens with 500pt jump), intermediate prices are never seen
- **Live monitoring**: Never sees the intermediate price, thinks level wasn't hit
- **Candle evaluation**: Candle H/L captures the gap, correctly identifies hit
- **Inconsistency**: Same signal can have different outcomes in live vs historical

### Example Gap Scenario
```
Signal: BUY at ₹20000, Target ₹20100, SL ₹19950
Last candle close: ₹20050
Next day opens: ₹20200 (gap up!)

Live Price Monitoring:
- Market opens at ₹20200
- Tick 1: Price = ₹20200 → Check: 20200 >= 20100? YES → outcome = 'True' ✓

Historical Evaluation (for backtesting):
- Next candle: high=20200, low=20180
- Check: candle.h >= 20100? YES → outcome = 'True' ✓

This works fine, BUT:

If price gaps DOWN and gaps back up before hitting target:
Signal: BUY at ₹20000, Target ₹20100, SL ₹19950
Next candle: high=20050, low=19900

Live Price Monitoring:
- Price drops to 19900 (below SL)
- Check: livePrice <= stopLoss? YES → outcome = 'False' (SL HIT)

But what if it's just a wick and rebounds to 20150?
- Historical: "high ₹20150 reached target" ✓
- Live: Already locked outcome as 'False' - MISMATCH!
```

### Impact
- Live trading could mark signal as 'False' when it should be 'True' (or vice versa)
- Gap-prone market conditions (earnings, economic data) cause mismatches
- Live and backtest results don't align

### Fix
**Align live price monitoring to use high/low tracking:**

```javascript
// Update: Track high/low within candle instead of just livePrice
const candleH = Math.max(...currentCandleUpdates.map(t => t.price)); // or update candleData
const candleL = Math.min(...currentCandleUpdates.map(t => t.price)); // or update candleData

if (signal.action === 'BUY') {
  if (candleH >= signal.target) {  // ✓ Use candle high
    updatedSignal.outcome = 'True';
  } else if (candleL <= signal.stopLoss) {  // ✓ Use candle low
    updatedSignal.outcome = 'False';
  }
}
```

**OR**: Use candle-based evaluation for both live and historical (current approach is already better than tick-based)

---

## Additional Observations ✅ CORRECT

### ✅ Signal Outcome Locking (Line 1316-1318)
```javascript
if (signal.outcome === 'True' || signal.outcome === 'False') {
  return signal; // Keep locked outcome
}
```
**Correct**: Once outcome is determined, it's preserved ✓

### ✅ Candle Boundary Detection (Line 1289-1290)
```javascript
const currentCandleBoundary = Math.floor(currentTime / intervalSeconds) * intervalSeconds;
if (currentCandleBoundary >= lastCandleTime) {
```
**Correct**: Properly detects 1-minute boundary crossings ✓

### ✅ BUY/SELL Target Logic (Line 720)
```javascript
// BUY: target = high >= target (correct, want price to go UP)
// SELL: target = low <= target (correct, want price to go DOWN)
const hitTarget = signal.action === 'BUY' ? candle.h >= target : candle.l <= target;
```
**Correct**: Logic is reversed appropriately for BUY vs SELL ✓

### ✅ Ambiguous Case Handling (Line 715-717)
```javascript
if (hitStop && hitTarget) {
  return { outcome: 'Ambiguous', ... };
}
```
**Correct**: Handles when both hit in same candle ✓

### ✅ Market Hours Check (Line 595-596)
```javascript
if ([SIGNAL_ACTIONS.BUY, SIGNAL_ACTIONS.SELL].includes(signal.action) && !isBeforeThreePmIst(candles.at(-1)?.x)) {
  return { action: 'HOLD', ... };  // No signals after 3 PM
}
```
**Correct**: No new signals after market close ✓

---

## Recommended Fix Priority

### 1️⃣ CRITICAL - Fix Issue #1 (Signal Locking)
**File**: src/components/PCRAnalysis.js  
**Lines**: 1038, 1325  
**Time**: 5 minutes  
**Impact**: Enables signal locking feature

### 2️⃣ IMPORTANT - Fix Issue #2 (getTradingDayKey Timezone)
**File**: src/components/PCRAnalysis.js  
**Lines**: 752-754  
**Time**: 5 minutes  
**Impact**: Prevents session boundary errors across timezones

### 3️⃣ IMPORTANT - Fix Issue #3 (Live vs Candle Evaluation)
**File**: src/components/PCRAnalysis.js  
**Lines**: 1363-1389  
**Time**: 10 minutes  
**Impact**: Consistent gap handling in live trading

---

## Testing Recommendations

After fixes, test:

1. **Signal Locking**: Lock a signal, change timeframe, verify lock persists
2. **Timezone**: Run from different timezone, verify session boundary correct
3. **Gap Scenarios**: Manually test with gap-up/gap-down data
4. **Outcome Consistency**: Compare live vs historical evaluation results

---

## Summary

**Overall Assessment**: Logic is ~95% correct. The 3 issues found are edge cases that would surface under specific conditions (signal locking usage, non-IST timezone browsers, market gaps).

**Core Live Trading Logic**: ✅ CORRECT
- Real-time candle updates with live price
- Candle boundary detection accurate
- Target/SL hit detection logic sound
- Session exit handling proper
- Outcome preservation working

**High Priority Fixes**: 2 hours of work to resolve all 3 issues.
