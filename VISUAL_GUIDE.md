# Visual Guide: Where the Changes Appear

## All Three Signal Tables Now Display

```
┌─────────────────────────────────────────────────────────────────────┐
│  📈 Combined Signals (or Reverse Signals / EMA Strategy)            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  26 decisions | Overall success: 26.9%                             │
│  Latest one-trade cost: ₹1493.35 (Premium ₹1491.75 + charges ₹1.60)│
│  Win amount: 24.1% | Completed investment: ₹63088.43               │
│                                                                     │
│  📈 ORIGINAL P/L: Gross P/L: ₹-7669.43 | Pending investment: ₹0.00 │
│                   Lot size: 65                                      │
│                                                                     │
│  💹 CURRENT P/L:  Gross P/L: ₹-5234.21 | Investment: ₹63088.43     │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  📊 Column Info: "Profit/Loss Points" = Original (Entry → Target/)  │
│                   Stop Loss) | "Current P/L Points" = Current      │
│                   (Entry → Current Price)                           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Time          │ Action │ Entry    │ Current │ ... │ P/L Points │    │
│               │        │ Price    │ Price   │     │ Current PL │    │
├─────────────────────────────────────────────────────────────────────┤
│ Oct 6, 11:05  │  BUY   │ ₹500.00  │ ₹502.10 │ ... │ +10.00 pts │    │
│               │        │          │         │     │ +2.10 pts  │    │
├─────────────────────────────────────────────────────────────────────┤
│ Oct 6, 10:45  │  BUY   │ ₹498.50  │ ₹497.20 │ ... │ -5.50 pts  │    │
│               │        │          │         │     │ -1.30 pts  │    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Header Sections Breakdown

### Section 1: Decision Count & Success Rate
```
26 decisions | Overall success: 26.9%
```
- Shows total trades analyzed
- Shows what % hit their target

### Section 2: Latest Trade Cost
```
Latest one-trade cost: ₹1493.35 (Premium ₹1491.75 + charges ₹1.60)
```
- Most recent signal's brokerage cost
- Total cash needed for one lot

### Section 3: Win Amount
```
Win amount: 24.1% | Completed investment: ₹63088.43
```
- What % of trades were profitable
- Total capital invested in completed trades

### Section 4: ORIGINAL P/L ⭐ NEW
```
📈 ORIGINAL P/L: Gross P/L: ₹-7669.43 | Pending investment: ₹0.00
                 Lot size: 65
```
- How much you would have gained/lost if all targets/stops hit
- Pending investment for trades still waiting for outcome
- Shows lot size used in calculations

### Section 5: CURRENT P/L ⭐ NEW
```
💹 CURRENT P/L: Gross P/L: ₹-5234.21 | Investment: ₹63088.43
```
- How much you've gained/lost based on current market price
- Total investment in this strategy
- Updates in real-time as price changes

### Section 6: Column Explanation
```
📊 Column Info: "Profit/Loss Points" = Original (Entry → Target/Stop Loss) |
                 "Current P/L Points" = Current (Entry → Current Price)
```
- Explains what each column in the table means
- Helps users understand the difference

---

## Color Coding

### Profit (Green) 🟢
```
Gross P/L: +₹648.40        ← Green text
P/L Points: +10.00 pts     ← Green text
Current P/L Points: +2.10 pts ← Green background
```

### Loss (Red) 🔴
```
Gross P/L: -₹651.60        ← Red text
P/L Points: -5.50 pts      ← Red text
Current P/L Points: -1.30 pts ← Red background
```

### Neutral (Default)
```
Gross P/L: ₹0.00           ← Normal text
P/L Points: 0.00 pts       ← Normal text
```

---

## Three Tables Show Same Format

### 1️⃣ Combined Signals
```
26 decisions | Overall success: 26.9%
📈 ORIGINAL P/L: Gross P/L: ₹-7669.43 ...
💹 CURRENT P/L: Gross P/L: ₹-5234.21 ...
```

### 2️⃣ Reverse Signals  
```
8 reverse decisions | Reverse success: 37.5%
📈 ORIGINAL P/L: Reverse Gross P/L: ₹+1200.50 ...
💹 CURRENT P/L: Reverse Gross P/L: ₹+950.25 ...
```

### 3️⃣ EMA Strategy (Loss-Making)
```
42 decisions | Overall Success: 15.5%
📈 ORIGINAL P/L: Realized P/L: ₹-8500.00 ...
💹 CURRENT P/L: Realized P/L: ₹-6200.75 ...
```

---

## Key Points

✅ Both ORIGINAL and CURRENT P/L visible at same time
✅ Users can easily compare theoretical vs real performance
✅ Lot size retained (65) in the header
✅ Statistics (decisions, success rate, investment) always visible
✅ Column info helps users understand the difference
✅ Green/red color coding for quick visual scanning
✅ All 3 tables use consistent format
