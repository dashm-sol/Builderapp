# 1-Minute Options Trading Strategy Playbook

> **Important note:** This document is **not a literal extraction from the four PDFs**. It is a consolidated strategy framework built from common trading knowledge aligned to the topics implied by the PDF titles: candlesticks, technical analysis, options strategies, and chart/institutional patterns.  
> **Success rates below are heuristic ranges only** and must be validated with market-specific backtesting before live use.

---

## Strategy overview

This playbook is designed for **1-minute index/large-cap options trading** where decisions are made from the **underlying chart first** and the option premium is used only for execution.

### Core philosophy
- Trade **with market structure first**, not with indicators alone.
- Use **confluence**, not single signals.
- Prefer liquid contracts:
  - ATM or 1-step ITM options
  - high volume, tight spreads
- Risk a **small fixed amount per trade**
- Avoid random entries in low-volatility periods

### Market workflow
1. Identify trend on higher context: **5m + 15m bias**
2. Execute on **1m chart**
3. Use **VWAP + EMA + structure + volume**
4. Take only setups with at least **2-3 confirmations**
5. Exit partial at 1R, trail remainder

---

## Best times to trade

### Preferred windows
- **Opening momentum:** first 15-45 minutes after open
- **Post-opening trend continuation:** next 30-60 minutes
- **Afternoon trend/reversal window:** final 60-90 minutes

### Avoid / reduce size
- First 3-5 minutes after open unless using an opening-range system
- Mid-session chop / lunch session
- Just before major news/events
- Low-volume expiry periods with unstable spreads

### Practical timing rules
- Wait for the **first structure** to form after open
- Trade only when the underlying shows:
  - clear higher high / higher low trend, or
  - clear lower high / lower low trend, or
  - breakout from a defined range

---

## Trading patterns to focus on

## Candlestick patterns to trade

### Bullish candlestick signals
| Pattern | What it means | Best context | Heuristic success rate* |
|---|---|---|---|
| Bullish Engulfing | Buyers absorb prior candle | At support, VWAP reclaim, pullback in uptrend | 55-62% |
| Hammer / Pin Bar | Rejection of lower prices | Sweep of prior low, support, demand zone | 54-60% |
| Morning Star | Reversal after selling | At key support after down move | 56-63% |
| Strong Marubozu | Momentum continuation | Breakout with volume | 58-65% |
| Inside Bar Breakout Up | Compression before expansion | Trend continuation after pullback | 52-59% |

### Bearish candlestick signals
| Pattern | What it means | Best context | Heuristic success rate* |
|---|---|---|---|
| Bearish Engulfing | Sellers absorb prior candle | At resistance, VWAP rejection, pullback in downtrend | 55-62% |
| Shooting Star / Bearish Pin Bar | Rejection of higher prices | Liquidity grab above prior high | 54-60% |
| Evening Star | Reversal after buying | At key resistance | 56-63% |
| Bearish Marubozu | Momentum continuation | Breakdown with volume | 58-65% |
| Inside Bar Breakout Down | Compression before expansion | Trend continuation after pullback | 52-59% |

\*Success rates assume trend filter + key level + disciplined stop placement. Raw pattern-only performance is usually weaker.

### Candlestick rules
- Do **not** trade a pattern in isolation.
- Pattern must appear:
  - at support/resistance,
  - at VWAP,
  - near EMA pullback,
  - or after a liquidity sweep.
- Prefer candles with **above-average volume**.

---

## Chart patterns to trade

### Bullish chart patterns
| Pattern | Entry logic | Target logic | Heuristic success rate |
|---|---|---|---|
| Bull Flag | Breakout above flag high after impulse move | Pole projection / prior swing | 58-66% |
| Ascending Triangle | Break above horizontal resistance | Triangle height projection | 57-64% |
| Double Bottom | Break above neckline after second low holds | Neckline-to-bottom projection | 55-62% |
| Inverse Head & Shoulders | Break and hold above neckline | Head-to-neckline projection | 58-65% |
| Range Breakout | Breakout + retest of range high | Range height projection | 56-63% |

### Bearish chart patterns
| Pattern | Entry logic | Target logic | Heuristic success rate |
|---|---|---|---|
| Bear Flag | Breakdown below flag low after impulse move | Pole projection / prior swing | 58-66% |
| Descending Triangle | Break below horizontal support | Triangle height projection | 57-64% |
| Double Top | Break below neckline after second high fails | Neckline-to-top projection | 55-62% |
| Head & Shoulders | Break and hold below neckline | Head-to-neckline projection | 58-65% |
| Range Breakdown | Breakdown + retest of range low | Range height projection | 56-63% |

### Pattern filters
- Breakout candle should close beyond the pattern edge
- Prefer volume expansion on breakout
- Stronger if aligned with:
  - VWAP direction
  - 20 EMA / 50 EMA trend
  - higher-timeframe bias

---

## Institutional patterns to trade

These are commonly used “smart money” or institutional-style concepts.

### Bullish institutional signals
| Pattern | Description | Trigger | Heuristic success rate |
|---|---|---|---|
| Liquidity Sweep Low + Reclaim | Price takes prior low then reclaims it | Enter above reclaim candle high | 56-64% |
| Bullish Order Block | Last down candle before impulsive up move | Enter on retest with rejection | 54-61% |
| Fair Value Gap (FVG) Fill + Bounce | Price returns to imbalance zone and reacts | Enter after bounce confirmation | 53-60% |
| Break of Structure (BOS) Up | Prior lower high/high broken with strength | Enter on retest or continuation | 57-65% |
| VWAP Reclaim after Sell Sweep | Trap move below VWAP reverses back above | Enter after close above VWAP | 55-62% |

### Bearish institutional signals
| Pattern | Description | Trigger | Heuristic success rate |
|---|---|---|---|
| Liquidity Sweep High + Reject | Price takes prior high then fails | Enter below rejection candle low | 56-64% |
| Bearish Order Block | Last up candle before impulsive down move | Enter on retest with rejection | 54-61% |
| Fair Value Gap (FVG) Fill + Reject | Price revisits imbalance and sells off | Enter after rejection candle | 53-60% |
| Break of Structure (BOS) Down | Prior swing low breaks with strength | Enter on retest or continuation | 57-65% |
| VWAP Rejection after Buy Sweep | Trap move above VWAP reverses back below | Enter after close below VWAP | 55-62% |

### Institutional pattern checklist
- Did price sweep a prior swing high/low?
- Was there a strong displacement candle?
- Did structure break after the sweep?
- Is there an unfilled FVG or order block nearby?
- Is VWAP aligned with the direction?

---

## Technical indicators and signals

## Primary indicators

### 1. VWAP
- **Bullish:** price above VWAP and VWAP holding on pullback
- **Bearish:** price below VWAP and VWAP rejecting on pullback
- Best use: intraday directional filter

### 2. EMA 20 / EMA 50
- **Bullish trend:** price above EMA20, EMA20 above EMA50
- **Bearish trend:** price below EMA20, EMA20 below EMA50
- EMA20 pullback entries are strong when volume returns

### 3. RSI (7 or 14)
- **Bullish:** RSI reclaims 50, or bullish divergence at support
- **Bearish:** RSI loses 50, or bearish divergence at resistance
- Avoid using RSI alone for entry

### 4. MACD
- **Bullish:** bullish crossover above/before zero line with structure break
- **Bearish:** bearish crossover below/before zero line with structure break
- Best in momentum continuation, weaker in chop

### 5. Volume
- **Bullish:** breakout candle volume > recent average
- **Bearish:** breakdown candle volume > recent average
- Low-volume breakouts are lower quality

### 6. ATR
- Use ATR to avoid placing stops too tight
- Good for dynamic stop sizing and trailing

---

## Indicator combinations

### High-quality bullish combinations
1. **Price above VWAP + EMA20 support + bullish engulfing**
2. **Opening range breakout + volume spike + RSI above 55**
3. **Liquidity sweep low + reclaim + BOS up + VWAP reclaim**
4. **Bull flag breakout + EMA20 rising + MACD bullish**

### High-quality bearish combinations
1. **Price below VWAP + EMA20 rejection + bearish engulfing**
2. **Opening range breakdown + volume spike + RSI below 45**
3. **Liquidity sweep high + rejection + BOS down + VWAP rejection**
4. **Bear flag breakdown + EMA20 falling + MACD bearish**

### Avoid entries when
- VWAP is flat and price is crossing repeatedly
- EMA20 and EMA50 are tangled
- RSI is stuck in 45-55 range
- Breakout occurs on weak volume

---

## Bullish entry signals

### A-grade call option setups

#### 1. Trend pullback long
- Higher timeframe bias bullish
- Price above VWAP
- EMA20 pullback holds
- Bullish candle pattern forms
- Volume returns on confirmation candle

**Entry:** above confirmation candle high  
**Stop:** below pullback low / below EMA20 rejection low  
**Target:** 1.5R, 2R, previous swing high

#### 2. Breakout long
- Range, triangle, or flag visible
- Breakout candle closes above structure
- Volume expands
- Retest holds or breakout continuation prints strong candle

**Entry:** on breakout or retest confirmation  
**Stop:** below breakout structure  
**Target:** measured move or 2R+

#### 3. Reversal long
- Prior low is swept
- Hammer / engulfing / morning star forms
- BOS up occurs
- Price reclaims VWAP or key EMA

**Entry:** above reversal candle high  
**Stop:** below sweep low  
**Target:** VWAP, prior high, 1.5R to 3R

---

## Bearish entry signals

### A-grade put option setups

#### 1. Trend pullback short
- Higher timeframe bias bearish
- Price below VWAP
- EMA20 rejection holds
- Bearish candle pattern forms
- Volume returns on confirmation candle

**Entry:** below confirmation candle low  
**Stop:** above pullback high / above EMA20 rejection high  
**Target:** 1.5R, 2R, previous swing low

#### 2. Breakdown short
- Range, triangle, or flag visible
- Breakdown candle closes below structure
- Volume expands
- Retest fails or continuation candle confirms

**Entry:** on breakdown or failed retest  
**Stop:** above breakdown structure  
**Target:** measured move or 2R+

#### 3. Reversal short
- Prior high is swept
- Shooting star / bearish engulfing / evening star forms
- BOS down occurs
- Price loses VWAP or key EMA

**Entry:** below reversal candle low  
**Stop:** above sweep high  
**Target:** VWAP, prior low, 1.5R to 3R

---

## Entry rules

Enter only when all are true:

1. Direction is clear from structure or higher timeframe bias
2. Price is aligned with VWAP or clearly reclaiming/rejecting it
3. At least one of these is present:
   - candlestick reversal/continuation pattern
   - chart pattern breakout/breakdown
   - institutional liquidity sweep / BOS / order block reaction
4. Volume confirms the move
5. Minimum reward potential is **1.5R**

### Simple bullish checklist
- [ ] 5m bias bullish
- [ ] 1m above VWAP or reclaims VWAP
- [ ] EMA20 support or breakout setup
- [ ] bullish pattern forms
- [ ] confirmation candle breaks trigger
- [ ] stop is logical and affordable
- [ ] target >= 1.5R

### Simple bearish checklist
- [ ] 5m bias bearish
- [ ] 1m below VWAP or rejects VWAP
- [ ] EMA20 resistance or breakdown setup
- [ ] bearish pattern forms
- [ ] confirmation candle breaks trigger
- [ ] stop is logical and affordable
- [ ] target >= 1.5R

---

## Exit rules

## Profit-taking
- First partial at **1R**
- Second partial at **2R**
- Trail balance behind:
  - previous 1m swing
  - EMA20
  - VWAP reclaim/reject failure

## Hard exit conditions
- Opposite engulfing candle at target zone
- Loss of VWAP in trade direction
- Break of last valid swing against position
- Volume collapse after failed breakout
- Time-based exit if setup does not move within 3-5 candles

## Stop-loss placement
- Below/above signal candle extreme
- Below/above swing low/high
- Outside order block or liquidity sweep level
- ATR buffer can be added to prevent noise stop-outs

---

## Risk/reward ratios

### Minimum acceptable
- **1:1.5** minimum

### Preferred
- **1:2** standard target
- **1:3** only on strong trend days / clean breakouts

### Reject trades when
- Stop is too wide for the option premium
- Spread/slippage destroys reward-to-risk
- Target is too close to major support/resistance

---

## Position sizing

### Core rule
Risk only **0.5% to 1.0% of account capital per trade**.

### Formula
```text
Account Risk Per Trade = Account Size × Risk %
Position Size = Account Risk Per Trade / (Entry Price - Stop Price)
```

### Option-specific sizing
- Use the **option premium risk**, not just underlying points
- Prefer contracts with:
  - tight bid/ask spread
  - strong open interest
  - high volume
- Reduce size for:
  - same-day expiry
  - volatile news windows
  - first breakout after a gap

### Daily risk limits
- Max daily loss: **2% to 3% of capital**
- Max consecutive losses: **3 trades**
- After max loss or loss streak: stop trading for the day

---

## Risk management rules

1. Never average down on losing options trades
2. Never trade illiquid strikes
3. Trade only when spread is acceptable
4. Use fixed predefined stop loss before entry
5. Skip trades during random chop
6. Do not revenge trade after stop-outs
7. Limit total open exposure to one clear thesis
8. Avoid overtrading after a strong morning move
9. Record every trade: setup, time, reason, outcome
10. Review by setup type weekly

---

## Strategy templates

## Bullish template
```text
IF
  higher_timeframe_bias = bullish
  AND price > VWAP
  AND EMA20 slope > 0
  AND (
    bullish_engulfing
    OR hammer_rejection
    OR bull_flag_breakout
    OR liquidity_sweep_low_reclaim
  )
  AND volume > average_volume
THEN
  buy_call = true
  stop = signal_low or swing_low
  target1 = 1R
  target2 = 2R
```

## Bearish template
```text
IF
  higher_timeframe_bias = bearish
  AND price < VWAP
  AND EMA20 slope < 0
  AND (
    bearish_engulfing
    OR shooting_star
    OR bear_flag_breakdown
    OR liquidity_sweep_high_reject
  )
  AND volume > average_volume
THEN
  buy_put = true
  stop = signal_high or swing_high
  target1 = 1R
  target2 = 2R
```

---

## Code-ready format

## JSON-style rule schema
```json
{
  "timeframe": "1m",
  "higherTimeframeBias": ["5m", "15m"],
  "instruments": ["ATM options", "1-step ITM options"],
  "filters": {
    "minRewardRisk": 1.5,
    "maxRiskPerTradePct": 1.0,
    "maxDailyLossPct": 3.0,
    "maxConsecutiveLosses": 3,
    "requireVolumeConfirmation": true
  },
  "indicators": {
    "vwap": true,
    "emaFast": 20,
    "emaSlow": 50,
    "rsi": 14,
    "macd": true,
    "atr": 14
  },
  "bullishSignals": [
    "bullish_engulfing_at_support",
    "hammer_after_liquidity_sweep",
    "morning_star_at_demand",
    "bull_flag_breakout",
    "ascending_triangle_breakout",
    "double_bottom_neckline_break",
    "inverse_head_shoulders_break",
    "vwap_reclaim",
    "bos_up",
    "order_block_bounce",
    "fvg_bounce"
  ],
  "bearishSignals": [
    "bearish_engulfing_at_resistance",
    "shooting_star_after_liquidity_sweep",
    "evening_star_at_supply",
    "bear_flag_breakdown",
    "descending_triangle_breakdown",
    "double_top_neckline_break",
    "head_shoulders_break",
    "vwap_rejection",
    "bos_down",
    "order_block_reject",
    "fvg_reject"
  ]
}
```

## Python-style signal pseudocode
```python
def bullish_entry(row):
    return (
        row["bias_5m"] == "bullish"
        and row["close"] > row["vwap"]
        and row["ema20"] > row["ema50"]
        and row["ema20_slope"] > 0
        and row["volume"] > row["volume_avg"]
        and (
            row["bullish_engulfing"]
            or row["hammer"]
            or row["bull_flag_breakout"]
            or row["liquidity_sweep_low_reclaim"]
            or row["bos_up"]
        )
    )

def bearish_entry(row):
    return (
        row["bias_5m"] == "bearish"
        and row["close"] < row["vwap"]
        and row["ema20"] < row["ema50"]
        and row["ema20_slope"] < 0
        and row["volume"] > row["volume_avg"]
        and (
            row["bearish_engulfing"]
            or row["shooting_star"]
            or row["bear_flag_breakdown"]
            or row["liquidity_sweep_high_reject"]
            or row["bos_down"]
        )
    )
```

## JavaScript-style signal pseudocode
```javascript
function bullishEntry(c) {
  return (
    c.bias5m === "bullish" &&
    c.close > c.vwap &&
    c.ema20 > c.ema50 &&
    c.ema20Slope > 0 &&
    c.volume > c.volumeAvg &&
    (
      c.bullishEngulfing ||
      c.hammer ||
      c.bullFlagBreakout ||
      c.liquiditySweepLowReclaim ||
      c.bosUp
    )
  );
}

function bearishEntry(c) {
  return (
    c.bias5m === "bearish" &&
    c.close < c.vwap &&
    c.ema20 < c.ema50 &&
    c.ema20Slope < 0 &&
    c.volume > c.volumeAvg &&
    (
      c.bearishEngulfing ||
      c.shootingStar ||
      c.bearFlagBreakdown ||
      c.liquiditySweepHighReject ||
      c.bosDown
    )
  );
}
```

---

## Summary of highest-quality setups

### Best bullish setups
1. **VWAP reclaim + bullish engulfing + volume**
2. **EMA20 pullback in uptrend + hammer**
3. **Bull flag breakout + BOS up**
4. **Sweep low + reclaim + FVG bounce**

### Best bearish setups
1. **VWAP rejection + bearish engulfing + volume**
2. **EMA20 pullback in downtrend + shooting star**
3. **Bear flag breakdown + BOS down**
4. **Sweep high + rejection + FVG reject**

### Final rule
The edge comes from:
- market structure,
- liquidity context,
- strict risk control,
- and selective execution,

not from any single pattern alone.
