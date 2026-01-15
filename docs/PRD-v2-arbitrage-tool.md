# FlipFinder v2.0 PRD
## From "Conservative Estimator" to "High-Precision Arbitrage Tool"

**Document Version:** 2.0
**Last Updated:** January 2026
**Status:** Draft for Review

---

## Executive Summary

FlipFinder's current implementation relies on a conservative pricing model that penalizes high-velocity items and obscures the data behind its recommendations. This PRD outlines a comprehensive overhaul to transform the app into a **transparent, data-driven arbitrage tool** that resellers can trust for real-time negotiation and profit-maximizing decisions.

**Key Outcomes:**
- Replace "black box" grades with transparent Net Profit as the hero metric
- Fix algorithmic flaws that assign D-grades to high-velocity profitable items
- Show users the actual eBay listings ("comps") behind every calculation
- Enable real-time grade animation tied to buy price negotiation

---

## Table of Contents

1. [Logic & Algorithm Overhaul](#1-logic--algorithm-overhaul-the-brain)
2. [UX Feature Enhancements](#2-ux-feature-enhancements-the-trust)
3. [UI & Visual Design System](#3-ui--visual-design-system-the-look)
4. [Technical Strategy](#4-technical-strategy)
5. [User Stories](#5-user-stories)
6. [Wireframe Descriptions](#6-wireframe-descriptions)
7. [Pseudocode Specifications](#7-pseudocode-specifications)

---

## 1. Logic & Algorithm Overhaul (The "Brain")

### 1.1 Fix the "Active vs. Sold" Flaw

**Current Problem:**
The app fetches Active listings from eBay Browse API, applies a flat 20% discount, and calls these "estimated sold prices." This conflates *competition* with *demand*. A market with 200 active listings isn't necessarily slow—it could be high-velocity with fast turnover.

**Root Cause Analysis:**
- eBay's Browse API doesn't expose sold/completed listings
- Current triangulation treats asking prices as a proxy for sold prices
- No true sell-through rate calculation exists

**Solution: Sell-Through Rate Estimation**

```
Sell-Through Rate (STR) = Estimated Sold / (Active + Estimated Sold)
```

Since we can't access true sold data, we'll estimate it using:

1. **AI-Powered Demand Signal:** Gemini already returns `demandLevel` (high/medium/low). Map this to estimated STR:
   - High demand → 65% STR baseline
   - Medium demand → 40% STR baseline
   - Low demand → 20% STR baseline

2. **Active Listing Adjustment:** Modify baseline by active listing density:
   - If active < 10 listings → STR +15% (scarcity indicator)
   - If active 10-50 listings → STR unchanged (healthy market)
   - If active > 50 listings → STR -10% (saturated market)

3. **Price Position Signal:** Compare AI estimate to eBay median:
   - If AI mid < eBay median × 0.8 → STR +10% (underpriced items sell fast)
   - If AI mid > eBay median × 1.2 → STR -10% (overpriced items sit)

**Market Type Classification:**

| STR Range | Market Type | Pricing Strategy |
|-----------|-------------|------------------|
| > 50% | Seller's Market | Use Active Median (buyers compete) |
| 30-50% | Balanced Market | Use Triangulated Mid (current approach) |
| < 30% | Buyer's Market | Use Sold Low estimate (conservative) |

**Implementation Location:** `lib/vest/velocity.ts` and `lib/api/ebay.ts`

---

### 1.2 The "Keyword Broadener" Fallback

**Current Problem:**
Gemini generates specific search queries like `"Stanley Quencher H2.0 FlowState Tumbler 40oz Matte Black minor scratches"` which return 0 eBay results. The app then falls back to extremely conservative $5-15-30 estimates.

**Solution: Progressive Query Relaxation**

Implement a 3-tier search cascade:

```
Tier 1: Full Query (as-is from Gemini)
        ↓ If results < 3
Tier 2: Core Query (brand + model + size, no condition/color)
        ↓ If results < 3
Tier 3: Base Query (brand + product type only)
```

**Query Transformation Rules:**

| Strip These | Keep These |
|-------------|------------|
| Condition words: "mint", "minor scratches", "excellent", "used" | Brand name |
| Color descriptors: "matte black", "rose gold" | Model number/name |
| Subjective qualifiers: "vintage", "rare", "collectible" | Size (if measurable) |
| Material descriptors: "stainless", "ceramic" | Core product type |

**Example Cascade:**
```
Tier 1: "Stanley Quencher H2.0 FlowState Tumbler 40oz Matte Black" → 0 results
Tier 2: "Stanley Quencher H2.0 40oz" → 12 results ✓
(Stop here, sufficient data)
```

**Data Quality Flag:**
When using Tier 2 or Tier 3 queries, set a `queryBroadened: true` flag and adjust confidence:
- Tier 1 match: confidence unchanged
- Tier 2 match: confidence × 0.85
- Tier 3 match: confidence × 0.70

**Implementation Location:** `lib/api/ebay.ts` → `searchEbayListings()`

---

### 1.3 V.E.S.T. Score Calibration

**Current Problem:**
A high-demand item selling in 6 days with $15 profit can receive a D- grade. This is a **critical logic failure**. Cash flow velocity is the #1 metric for resellers—a fast nickel beats a slow dime.

**Root Cause:**
The current algorithm weights all components equally within their category, allowing low stability or trend scores to tank overall grade despite excellent velocity and equity.

**Solution: Velocity Override Rules**

Hard-code business logic that reflects reseller priorities:

```typescript
// VELOCITY OVERRIDE: Fast + Profitable = At Least B
if (daysToSell <= 10 && netProfit >= 10) {
  minimumGrade = 'B';
}

// CASH FLOW KING: Very Fast + Any Profit = At Least B-
if (daysToSell <= 5 && netProfit >= 5) {
  minimumGrade = 'B-';
}

// PROFIT OVERRIDE: High Margin = Floor Boost
if (grossMargin >= 0.50 && netProfit >= 25) {
  minimumGrade = 'B+';
}

// Apply floor: final grade cannot be lower than minimumGrade
```

**Current Grade Calculation Flow:**
```
Score → Grade → Recommendation
```

**New Flow:**
```
Score → Grade → Apply Override Floor → Final Grade → Recommendation
```

**Override Logging:**
When an override is applied, include in the response:
```json
{
  "gradeOverride": {
    "originalGrade": "D-",
    "finalGrade": "B",
    "reason": "VELOCITY_OVERRIDE: 6-day sell time with $18 profit"
  }
}
```

**Implementation Location:** `lib/vest/grade.ts`

---

### 1.4 True "Net Profit" Calculator

**Current Problem:**
The displayed "Est. Profit" uses a simplified formula that doesn't match real-world eBay economics. Users see "$20 profit" but net $12 after fees and shipping.

**Current Formula:**
```
profit = medianSoldPrice - buyPrice - shipping - (medianSoldPrice × 0.13)
```

**Issues:**
1. eBay fees vary by category (12.9% to 15%)
2. PayPal/payment processing not included
3. Shipping costs are static ($5 default)
4. No promoted listing fee consideration
5. Sales tax handling unclear

**New "True Net Profit" Formula:**

```typescript
interface ProfitBreakdown {
  soldPrice: number;           // Expected sale price
  ebayFinalValueFee: number;   // 12.9% of (item + shipping)
  paymentProcessingFee: number; // 2.9% + $0.30
  shippingCost: number;        // User-adjustable, category defaults
  promotedListingFee: number;  // Optional: 0-15% of sale
  buyPrice: number;            // User input
  netProfit: number;           // Final take-home
  effectiveMargin: number;     // netProfit / soldPrice
  roi: number;                 // netProfit / totalInvestment
}

// Calculation
const ebayFee = soldPrice * 0.129;
const paymentFee = (soldPrice * 0.029) + 0.30;
const promotedFee = soldPrice * (promotedRate || 0);
const totalFees = ebayFee + paymentFee + promotedFee;
const totalCost = buyPrice + shippingCost;
const netProfit = soldPrice - totalFees - totalCost;
```

**Category-Specific Shipping Defaults:**

| Category | Default Shipping | Rationale |
|----------|------------------|-----------|
| Electronics (small) | $8 | Padded flat rate |
| Electronics (large) | $15 | Medium flat rate |
| Clothing | $6 | Poly mailer |
| Shoes | $10 | Priority Mail |
| Books/Media | $4 | Media mail |
| Home goods (small) | $8 | Regional rate |
| Home goods (large) | $20 | UPS Ground |
| Fragile/Glass | $12 | Extra padding |

**UI Requirement:**
Show fee breakdown on tap/click:
```
Sale Price:        $45.00
─────────────────────────
eBay Fee (12.9%):  -$5.81
Payment Fee:       -$1.61
Shipping:          -$8.00
Your Cost:         -$12.00
─────────────────────────
NET PROFIT:        $17.58
```

**Implementation Location:** `lib/vest/equity.ts`, new `lib/utils/profit-calculator.ts`

---

## 2. UX Feature Enhancements (The "Trust")

### 2.1 The "Comps Gallery" (Crucial Feature)

**User Problem:**
Users are asked to trust a price estimate without seeing the evidence. "Why does it say $45? What listings did it look at?"

**Feature Description:**
A horizontally scrolling carousel showing the actual eBay listings used for price calculation.

**Data Requirements:**
- Fetch up to 12 active listings with images (current: 50 without images)
- Store: title, price, condition, imageUrl, itemWebUrl, seller rating

**Component Specifications:**

```
┌─────────────────────────────────────────────────────────┐
│  Comparable Listings (12 found)          [View on eBay] │
├─────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│ │      │ │      │ │      │ │      │ │      │  ←scroll→ │
│ │ IMG  │ │ IMG  │ │ IMG  │ │ IMG  │ │ IMG  │           │
│ │      │ │      │ │      │ │      │ │      │           │
│ ├──────┤ ├──────┤ ├──────┤ ├──────┤ ├──────┤           │
│ │$42.99│ │$38.00│ │$45.00│ │$52.00│ │$35.99│           │
│ │ Good │ │ Used │ │ New  │ │ VG   │ │ Fair │           │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                         │
│ Tap listing to EXCLUDE from calculation                 │
└─────────────────────────────────────────────────────────┘
```

**Interaction: Exclude Listing**

1. User taps a listing card
2. Card shows "Exclude?" overlay with checkmark
3. On confirm:
   - Card slides out with animation
   - Excluded listing grayed out at end of carousel
   - Price estimate recalculates instantly
   - Toast: "Recalculated without 1 listing"

**Exclusion Reasons (Quick Select):**
- "Different model"
- "Wrong condition"
- "Incomplete/broken"
- "Outlier price"
- "Other"

**State Management:**
```typescript
interface CompsState {
  allListings: ActiveListing[];
  excludedIds: Set<string>;
  exclusionReasons: Map<string, string>;
  activeListings: ActiveListing[]; // computed: all minus excluded
}
```

**Recalculation Trigger:**
When exclusions change, immediately:
1. Recalculate avg/median/min/max from remaining listings
2. Re-run triangulation with new eBay data
3. Update V.E.S.T. score
4. Animate grade badge if grade changes

**Implementation Location:** New `components/results/comps-gallery.tsx`

---

### 2.2 The "Negotiation Slider" (Grade Animation)

**Current State:**
The buy price slider updates profit display but the grade remains static at page load.

**Enhanced Behavior:**
As the slider moves, the V.E.S.T. grade animates in real-time, enabling users to find their "target buy price" for a specific grade.

**Animation Specifications:**

1. **Grade Badge Animation:**
   - Scale pulse on grade change (1.0 → 1.1 → 1.0, 200ms)
   - Color transition (smooth 300ms)
   - Letter morphing animation (optional, using Framer Motion)

2. **Score Ring Animation:**
   - Circular progress smoothly animates to new percentage
   - Color gradient shifts with score

3. **Recommendation Label Animation:**
   - Fade out old label (150ms)
   - Fade in new label (150ms)
   - Background color transition

**"Target Grade" Feature:**

Add toggle: "Find my price for grade: [A] [B] [C]"

When user selects target grade:
1. Binary search to find maximum buy price that achieves grade
2. Animate slider to that position
3. Show: "Pay up to $X for a [B] grade"

**Implementation:**

```typescript
function findPriceForGrade(targetGrade: string, marketData: MarketData): number {
  let low = 0;
  let high = marketData.summary.medianSoldPrice;

  while (high - low > 0.50) { // $0.50 precision
    const mid = (low + high) / 2;
    const score = calculateVestScore(marketData, { buyPrice: mid });

    if (gradeValue(score.grade) >= gradeValue(targetGrade)) {
      low = mid; // Can pay more and still hit grade
    } else {
      high = mid; // Need to pay less
    }
  }

  return Math.floor(low); // Round down to ensure grade
}
```

**Negotiation Mode UI:**

```
┌─────────────────────────────────────────────────────────┐
│  💰 NEGOTIATION MODE                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  "To hit an A grade, offer no more than:"              │
│                                                         │
│              ┌─────────────┐                            │
│              │    $8.00    │  ← animated counter        │
│              └─────────────┘                            │
│                                                         │
│  Current offer: $12.00 → Grade: B-                     │
│                                                         │
│  ○────────────●──────────────○                         │
│  $0          $12           $24                          │
│                                                         │
│  [ Show Seller ] ← opens screen share friendly view    │
└─────────────────────────────────────────────────────────┘
```

**"Show Seller" View:**
Simplified screen with large text, suitable for showing a seller:
- Item name
- "Fair market value: $XX"
- "My offer: $XX"
- V.E.S.T. grade badge (for credibility)
- No proprietary profit calculations visible

**Implementation Location:** Enhance `components/results/profit-slider.tsx`, new `components/results/negotiation-mode.tsx`

---

## 3. UI & Visual Design System (The "Look")

### 3.1 Hierarchy Redesign

**Current Problem:**
The V.E.S.T. grade (often a disappointing "D-") is the visual hero. Users see the grade before understanding the profit potential.

**New Hierarchy (Top to Bottom):**

```
1. NET PROFIT (Hero)     → "+$18.50" in large green text
2. LIQUIDITY GAUGE       → Speedometer showing sell speed
3. GRADE BADGE           → Supporting credibility indicator
4. COMPS GALLERY         → Evidence/transparency
5. BREAKDOWN DETAILS     → For power users
```

**New "Profit Hero" Component:**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                      +$18.50                            │
│                    NET PROFIT                           │
│                                                         │
│           42% ROI  •  Sells in ~6 days                 │
│                                                         │
│    ┌─────────────────────────────────────────┐         │
│    │ ████████████████████░░░░░ │ HIGH VELOCITY│         │
│    └─────────────────────────────────────────┘         │
│                                                         │
│              ┌────┐                                     │
│              │ B+ │  Strong Buy                         │
│              └────┘                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Color Semantics:**

| Metric | Positive | Neutral | Negative |
|--------|----------|---------|----------|
| Net Profit | `#22c55e` (green-500) | `#fbbf24` (amber-400) | `#ef4444` (red-500) |
| ROI | Green if > 30% | Yellow if 10-30% | Red if < 10% |
| Velocity | Green if < 7 days | Yellow if 7-14 days | Red if > 14 days |
| Grade | Green (A/B) | Yellow (C) | Red (D/F) |

**Liquidity Gauge (Speedometer) Specs:**

```
        SLOW                    FAST
          │                      │
    ┌─────┴──────────────────────┴─────┐
    │   🔴    🟡    🟢    🟢    🟢    │
    │   30d   14d   7d    3d    1d    │
    └─────────────────▲────────────────┘
                      │
                  ~6 days
                "HIGH VELOCITY"
```

- Arc visualization using SVG or Canvas
- Needle animates to position on load
- Color gradient from red (slow) to green (fast)
- Label below: "Sells in ~X days" + velocity descriptor

**Implementation Location:** New `components/results/profit-hero.tsx`, `components/results/liquidity-gauge.tsx`

---

### 3.2 Condensed Analysis Text

**Current Problem:**
AI insights are verbose paragraphs that users don't read on mobile.

**Solution: Structured Bullet Output**

Force Gemini to return structured signals:

```typescript
interface AISignals {
  positive: string[];   // Max 3 items, prefix with ✅
  cautions: string[];   // Max 2 items, prefix with ⚠️
  warnings: string[];   // Max 2 items, prefix with 🛑
}
```

**Prompt Addition:**
```
Additionally, provide a "signals" object with:
- "positive": Up to 3 SHORT (5-10 word) reasons this is a good buy
- "cautions": Up to 2 SHORT things to verify
- "warnings": Up to 2 SHORT dealbreakers to watch for

Examples:
- positive: ["High demand, sells within a week", "Brand holds resale value"]
- cautions: ["Check for battery health", "Verify all accessories included"]
- warnings: ["Market saturated - 100+ active listings", "Fakes common in this category"]
```

**Display Format:**

```
┌─────────────────────────────────────────────────────────┐
│  AI ANALYSIS                                            │
├─────────────────────────────────────────────────────────┤
│  ✅ High demand, typically sells within 5 days         │
│  ✅ Stanley brand holds 80%+ resale value              │
│  ✅ Trending product, search volume up 40%             │
│                                                         │
│  ⚠️ Check lid seal condition                           │
│  ⚠️ Verify authentic (many fakes exist)                │
│                                                         │
│  🛑 Scratches significantly reduce value               │
└─────────────────────────────────────────────────────────┘
```

**Implementation Location:** Update Gemini prompts in `lib/api/gemini.ts`, new `components/results/ai-signals.tsx`

---

### 3.3 Visual Design System ("Bloomberg for Thrifters")

**Design Philosophy:**
Professional, data-dense, scannable. Users should feel like they're using a trading terminal, not a toy app.

**Color Palette:**

```css
/* Backgrounds */
--background: #0a0a0f;        /* Near black */
--card: #12121a;              /* Elevated surface */
--card-elevated: #1a1a24;     /* Modal/dropdown */

/* Borders */
--border: #1e1e2e;            /* Subtle dividers */
--border-focus: #3b3b52;      /* Active states */

/* Text */
--text-primary: #fafafa;      /* Primary content */
--text-secondary: #a1a1aa;    /* Labels, captions */
--text-muted: #52525b;        /* Disabled, hints */

/* Semantic Colors */
--buy: #22c55e;               /* Profit, positive, buy signals */
--buy-muted: #166534;         /* Buy backgrounds */
--hold: #fbbf24;              /* Caution, neutral */
--hold-muted: #854d0e;        /* Hold backgrounds */
--pass: #ef4444;              /* Loss, negative, warnings */
--pass-muted: #991b1b;        /* Pass backgrounds */

/* Accents */
--accent-blue: #3b82f6;       /* Links, interactive elements */
--accent-purple: #8b5cf6;     /* Premium features, highlights */
```

**Typography:**

```css
/* Headings */
--font-display: 'SF Pro Display', system-ui;
--font-mono: 'SF Mono', 'Fira Code', monospace;

/* Sizes */
--text-hero: 48px;            /* Net profit number */
--text-xl: 24px;              /* Section headers */
--text-lg: 18px;              /* Card titles */
--text-base: 14px;            /* Body text */
--text-sm: 12px;              /* Captions, labels */
--text-xs: 10px;              /* Badges, metadata */
```

**Component Styling:**

```css
/* Cards */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}

/* Data cells (like Bloomberg) */
.data-cell {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

/* Profit display */
.profit-positive {
  color: var(--buy);
  text-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
}

.profit-negative {
  color: var(--pass);
  text-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
}
```

**Micro-interactions:**

1. **Grade change:** Pulse animation + subtle screen flash in grade color
2. **Profit update:** Number counter animation (odometer style)
3. **Listing exclusion:** Card shrinks and fades, remaining cards shift
4. **Slider drag:** Haptic feedback on grade threshold crossings
5. **Save to history:** Checkmark animation with confetti for A+ grades

**Implementation Location:** Update `app/globals.css`, create `lib/design-tokens.ts`

---

## 4. Technical Strategy

### 4.1 Offline Queue ("Dead Zone Mode")

**User Problem:**
Thrift stores (especially Goodwill bins, estate sales) often have poor cellular signal. Users can't scan items in the moment.

**Solution: Offline Photo Queue**

**Capabilities When Offline:**
- Camera capture works (device-native)
- Photos stored in IndexedDB
- Queue management UI
- View previously cached results

**Queue Specifications:**

```typescript
interface QueuedScan {
  id: string;
  imageBase64: string;
  capturedAt: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: ScanResult;
  error?: string;
  retryCount: number;
}

const MAX_QUEUE_SIZE = 20;
const MAX_RETRIES = 3;
```

**Queue UI:**

```
┌─────────────────────────────────────────────────────────┐
│  📶 OFFLINE MODE                     [Queue: 7 items]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📸 Tap to add photos - they'll process when online    │
│                                                         │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │ │ 6  │ │ 7  │    │
│  │    │ │    │ │    │ │    │ │    │ │    │ │    │    │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘    │
│                                                         │
│  [ Process Queue Now ] (when back online)              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Processing Behavior:**

1. **Auto-detect online:** Use `navigator.onLine` + fetch heartbeat
2. **Background processing:** Process queue items sequentially
3. **Notification:** Push notification when queue completes
4. **Error handling:** Retry failed items up to 3 times, then mark failed

**Storage Management:**
- Use IndexedDB for image blobs (localStorage too small)
- Compress images before storage (max 1MB each)
- Auto-cleanup: Remove processed items after 24 hours
- Storage warning at 80% of quota

**Implementation Location:** New `lib/offline/queue.ts`, `hooks/use-offline-queue.ts`, `components/offline/queue-manager.tsx`

---

### 4.2 Latency Masking ("Progress Theater")

**Current Problem:**
Analysis takes 3-8 seconds. A spinner with no context feels broken.

**Solution: Animated Progress Stepper**

**Stages:**

```typescript
const ANALYSIS_STAGES = [
  { id: 'capture', label: 'Image captured', icon: '📸', duration: 0 },
  { id: 'identify', label: 'Identifying item...', icon: '🔍', duration: 2000 },
  { id: 'search', label: 'Searching eBay...', icon: '🛒', duration: 2500 },
  { id: 'analyze', label: 'Analyzing market...', icon: '📊', duration: 1500 },
  { id: 'calculate', label: 'Calculating profit...', icon: '💰', duration: 1000 },
  { id: 'complete', label: 'Done!', icon: '✅', duration: 0 },
];
```

**Visual Design:**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    🔍                                   │
│              Identifying item...                        │
│                                                         │
│  ───●────────●────────○────────○────────○───           │
│    📸        🔍       🛒       📊       💰              │
│                                                         │
│           "Sony WH-1000XM4..."                         │
│        (partial result preview)                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Progressive Disclosure:**
As each stage completes, reveal partial information:
- After identify: Show item name + thumbnail
- After search: Show "Found 23 listings"
- After analyze: Show price range preview
- After calculate: Transition to full results

**Fake Progress Consideration:**
If actual API is faster than expected:
- Minimum display time per stage: 400ms (feels intentional)
- If slower: Extend current stage, add "Taking longer than usual..."
- Timeout at 15s: Show error with retry option

**Implementation Location:** New `components/scan/analysis-progress.tsx`, update `app/page.tsx`

---

## 5. User Stories

### User Story 1: The Bin Diver

**Persona:** Marcus, 34, full-time eBay reseller
**Context:** Digging through Goodwill Outlet bins (pay by the pound)
**Device:** iPhone 14 Pro, often poor signal

**Story:**
> As a high-volume bin diver, I need to scan 50+ items per hour and instantly know which are worth pulling from the bin, so I can maximize my hourly profit while competing with other resellers.

**Acceptance Criteria:**
1. [ ] Can capture photo in under 2 seconds from app open
2. [ ] See NET PROFIT as the first and largest number
3. [ ] Velocity indicator shows if item sells fast enough for my model (< 7 days)
4. [ ] Grade of B- or higher auto-highlighted with green border
5. [ ] If offline, photos queue automatically with visual confirmation
6. [ ] When signal returns, queued items process in background
7. [ ] Push notification when queue processing completes
8. [ ] Can process 20 items in queue without running out of storage

**Key Flows:**
```
Happy Path:
Camera → Snap → 3s loading → "+$22 | 4 days | A-" → Toss in cart

Offline Path:
Camera → Snap → "Queued #7" → Continue scanning → Signal returns → Notification: "7 items ready"

Edge Case:
Camera → Snap → "No listings found" → See broadened search → "Found 8 with relaxed query"
```

---

### User Story 2: The Negotiator

**Persona:** Priya, 28, part-time reseller + interior designer
**Context:** At estate sales and antique malls, negotiating with sellers
**Device:** iPad Mini, good signal

**Story:**
> As a reseller who negotiates prices, I need to show sellers data-backed evidence of market value, so I can confidently negotiate lower prices without seeming lowball-ish.

**Acceptance Criteria:**
1. [ ] Can show seller the "Comps Gallery" with real eBay screenshots
2. [ ] Price slider shows real-time grade changes as I adjust offer
3. [ ] "Target Grade" feature tells me max I can pay for an A or B
4. [ ] "Show Seller" mode hides my profit calculation
5. [ ] Can exclude outlier comps that don't match my item
6. [ ] Excluding a comp instantly recalculates the estimate
7. [ ] Fee breakdown shows eBay takes 13%, validating my margins
8. [ ] Can screenshot the "Fair Market Value" screen to text seller later

**Key Flows:**
```
Negotiation Path:
Scan item → See $45 value → Tap "Find price for B+" → Shows "$12 max" →
Show seller comps → "See, these sold for $38-52" → Offer $10 → Seller accepts

Exclusion Path:
See comps → One is broken → Tap to exclude → Estimate drops $8 →
"That one was damaged, mine is mint" → Renegotiate with updated number
```

---

### User Story 3: The Cautious Newbie

**Persona:** David, 52, retiring accountant starting resale side hustle
**Context:** Learning the ropes, risk-averse, shops at garage sales
**Device:** Android phone, always good signal

**Story:**
> As a new reseller afraid of buying duds, I need clear explanations of why an item is or isn't worth buying, so I can learn the market while minimizing expensive mistakes.

**Acceptance Criteria:**
1. [ ] AI signals clearly show ✅ positives, ⚠️ cautions, and 🛑 warnings
2. [ ] Each warning explains WHY (e.g., "Fakes common - verify authenticity")
3. [ ] Grade override shows when fast sellers get boosted ("Originally D, boosted to B due to velocity")
4. [ ] Net profit breakdown shows exactly where money goes (eBay fee, shipping, etc.)
5. [ ] Can tap any number to see how it was calculated
6. [ ] History shows my past scans with actual outcomes (if I mark sold)
7. [ ] "Data Quality" indicator shows if estimate is high/medium/low confidence
8. [ ] Items with < 3 comps show strong warning about estimate reliability

**Key Flows:**
```
Learning Path:
Scan item → See "+$15 | B-" → Tap profit → See breakdown → "Ah, eBay takes $6"
→ Tap "⚠️ Check for chips" → Learn to inspect pottery → Buy with confidence

Avoidance Path:
Scan item → See "🛑 Saturated market - 200 active listings" →
See 0.2 sell-through rate → Understand why it's a pass → Don't buy
```

---

## 6. Wireframe Descriptions

### 6.1 New "Analysis Result" Screen Layout

**Screen Dimensions:** 390 x 844 (iPhone 14 Pro)

```
┌─────────────────────────────────────────────────────────┐
│ ← Back                              FlipFinder     ⋮   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │              [ ITEM IMAGE 16:9 ]                  │ │
│  │                                                   │ │
│  │  +2 more ●●○                                      │ │
│  ├───────────────────────────────────────────────────┤ │
│  │  Sony WH-1000XM4 Wireless Headphones              │ │
│  │  Electronics > Audio > Headphones                 │ │
│  │  ┌──────┐ ┌────────┐ ┌────────────┐              │ │
│  │  │ 92%  │ │  Good  │ │ 📍PNW Find │              │ │
│  │  └──────┘ └────────┘ └────────────┘              │ │
│  │                                                   │ │
│  │  [ + Add Photos ]     [ ✏️ Not right? ]          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │               NET PROFIT                          │ │
│  │                                                   │ │
│  │              +$18.50                              │ │  ← HERO ELEMENT
│  │           (tap for breakdown)                     │ │
│  │                                                   │ │
│  │     42% ROI    •    Sells in ~6 days             │ │
│  │                                                   │ │
│  │   ┌─────────────────────────────────────────┐    │ │
│  │   │█████████████████████░░░░░│ HIGH VELOCITY│    │ │  ← Liquidity Gauge
│  │   └─────────────────────────────────────────┘    │ │
│  │                                                   │ │
│  │              ┌─────────┐                         │ │
│  │              │   B+    │                         │ │  ← Grade Badge
│  │              │  STRONG │                         │ │
│  │              │   BUY   │                         │ │
│  │              └─────────┘                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  YOUR OFFER                                       │ │
│  │                                                   │ │
│  │  $12.00            [ Find Price for: A  B  C ]   │ │
│  │  ○───────────●─────────────────────────○         │ │  ← Negotiation Slider
│  │  $0                                    $50       │ │
│  │                                                   │ │
│  │  [ 👁️ Show Seller View ]                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  COMPS (23 found)                    View All →   │ │
│  │                                                   │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │ │
│  │  │     │ │     │ │     │ │     │ │     │  →    │ │  ← Horizontal scroll
│  │  │ IMG │ │ IMG │ │ IMG │ │ IMG │ │ IMG │       │ │
│  │  │     │ │     │ │     │ │     │ │     │       │ │
│  │  │$42  │ │$38  │ │$45  │ │$52  │ │$35  │       │ │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘       │ │
│  │  Tap to exclude • Recalculates instantly         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  AI SIGNALS                                       │ │
│  │                                                   │ │
│  │  ✅ Premium brand, holds 85% resale value        │ │
│  │  ✅ High demand, consistent sales weekly         │ │
│  │  ✅ Noise canceling models most sought after     │ │
│  │                                                   │ │
│  │  ⚠️ Check ear pad condition                      │ │
│  │  ⚠️ Verify Bluetooth pairing works               │ │
│  │                                                   │ │
│  │  🛑 Battery degradation common after 2 years     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  MARKET DATA                          [Expand ↓] │ │
│  │                                                   │ │
│  │  Price Range     $28 ────●──── $65    Med: $45   │ │
│  │  Sell-Through    ████████████░░░░░░░░░  62%      │ │
│  │  Active Listings 23                               │ │
│  │  Avg Days Listed 6                                │ │
│  │  Data Quality    ●●●○○  Medium (Tier 2 query)    │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  V.E.S.T. BREAKDOWN                   [Expand ↓] │ │
│  │                                                   │ │
│  │  V │████████████████░░░│ 82  Velocity            │ │
│  │  E │███████████████░░░░│ 78  Equity              │ │
│  │  S │██████████░░░░░░░░░│ 55  Stability           │ │
│  │  T │████████████░░░░░░░│ 65  Trend               │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────┐  ┌────────────────────────┐    │
│  │    💾 Save Scan    │  │     🔄 Scan Another    │    │
│  └────────────────────┘  └────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 6.2 Fee Breakdown Modal (on profit tap)

```
┌─────────────────────────────────────────────────────────┐
│                                                    ✕    │
│                   FEE BREAKDOWN                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Expected Sale Price                         $45.00    │
│  ───────────────────────────────────────────────────   │
│                                                         │
│  eBay Final Value Fee (12.9%)                -$5.81    │
│  Payment Processing (2.9% + $0.30)           -$1.61    │
│  Shipping Cost                               -$8.00    │
│  ───────────────────────────────────────────────────   │
│  Total Platform Costs                       -$15.42    │
│                                                         │
│  Your Purchase Price                        -$12.00    │
│  ───────────────────────────────────────────────────   │
│                                                         │
│  NET PROFIT                                  $17.58    │
│  Return on Investment                          146%    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 💡 Tip: Free shipping listings sell 20% faster  │   │
│  │    but eat into margin. Price accordingly.      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 6.3 Seller View Mode

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    MARKET VALUE                         │
│                                                         │
│                  ┌───────────────┐                      │
│                  │               │                      │
│                  │  [ ITEM IMG ] │                      │
│                  │               │                      │
│                  └───────────────┘                      │
│                                                         │
│            Sony WH-1000XM4 Headphones                   │
│                                                         │
│         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━              │
│                                                         │
│              FAIR MARKET VALUE                          │
│                                                         │
│                   $38 - $52                             │
│                                                         │
│              Based on 23 eBay sales                     │
│                                                         │
│         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━              │
│                                                         │
│                MY OFFER: $35                            │
│                                                         │
│              ┌─────────────────┐                        │
│              │  FlipFinder B+  │                        │
│              └─────────────────┘                        │
│                                                         │
│              [ Exit Seller View ]                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Pseudocode Specifications

### 7.1 Net Profit Calculator

```typescript
// lib/utils/profit-calculator.ts

interface ProfitInput {
  expectedSalePrice: number;
  buyPrice: number;
  shippingCost?: number;
  category?: string;
  promotedListingRate?: number; // 0-0.15
}

interface ProfitBreakdown {
  expectedSalePrice: number;
  ebayFinalValueFee: number;
  paymentProcessingFee: number;
  shippingCost: number;
  promotedListingFee: number;
  totalPlatformCosts: number;
  buyPrice: number;
  netProfit: number;
  roi: number;           // percentage
  effectiveMargin: number; // percentage
}

// Category-specific shipping defaults
const SHIPPING_DEFAULTS: Record<string, number> = {
  'electronics-small': 8,
  'electronics-large': 15,
  'clothing': 6,
  'shoes': 10,
  'books': 4,
  'home-small': 8,
  'home-large': 20,
  'fragile': 12,
  'default': 8,
};

// eBay fee rates by category (simplified)
const EBAY_FEE_RATES: Record<string, number> = {
  'electronics': 0.129,    // 12.9%
  'clothing': 0.129,
  'collectibles': 0.129,
  'books': 0.1455,         // 14.55% for media
  'default': 0.129,
};

export function calculateNetProfit(input: ProfitInput): ProfitBreakdown {
  const {
    expectedSalePrice,
    buyPrice,
    shippingCost,
    category = 'default',
    promotedListingRate = 0,
  } = input;

  // Determine shipping cost
  const shipping = shippingCost ?? SHIPPING_DEFAULTS[category] ?? SHIPPING_DEFAULTS.default;

  // Calculate eBay Final Value Fee
  // Note: FVF applies to item price + shipping
  const feeRate = EBAY_FEE_RATES[category] ?? EBAY_FEE_RATES.default;
  const ebayFinalValueFee = (expectedSalePrice + shipping) * feeRate;

  // Payment processing fee (PayPal/Managed Payments)
  // 2.9% + $0.30 per transaction
  const paymentProcessingFee = (expectedSalePrice * 0.029) + 0.30;

  // Promoted listing fee (optional)
  const promotedListingFee = expectedSalePrice * promotedListingRate;

  // Total platform costs
  const totalPlatformCosts = ebayFinalValueFee + paymentProcessingFee + promotedListingFee + shipping;

  // Net profit
  const netProfit = expectedSalePrice - totalPlatformCosts - buyPrice;

  // ROI: profit relative to total investment (buy price + shipping)
  const totalInvestment = buyPrice + shipping;
  const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

  // Effective margin: profit relative to sale price
  const effectiveMargin = expectedSalePrice > 0 ? (netProfit / expectedSalePrice) * 100 : 0;

  return {
    expectedSalePrice: round(expectedSalePrice),
    ebayFinalValueFee: round(ebayFinalValueFee),
    paymentProcessingFee: round(paymentProcessingFee),
    shippingCost: round(shipping),
    promotedListingFee: round(promotedListingFee),
    totalPlatformCosts: round(totalPlatformCosts),
    buyPrice: round(buyPrice),
    netProfit: round(netProfit),
    roi: round(roi),
    effectiveMargin: round(effectiveMargin),
  };
}

function round(num: number): number {
  return Math.round(num * 100) / 100;
}

// Helper to determine if deal is worth it
export function evaluateDeal(breakdown: ProfitBreakdown): {
  isWorthIt: boolean;
  reason: string;
} {
  if (breakdown.netProfit < 5) {
    return { isWorthIt: false, reason: 'Profit too low after fees' };
  }
  if (breakdown.roi < 20) {
    return { isWorthIt: false, reason: 'ROI below 20% threshold' };
  }
  if (breakdown.effectiveMargin < 15) {
    return { isWorthIt: false, reason: 'Margin too thin for platform fees' };
  }
  return { isWorthIt: true, reason: 'Meets profitability thresholds' };
}
```

---

### 7.2 Keyword Broadener

```typescript
// lib/api/keyword-broadener.ts

interface BroadenResult {
  query: string;
  tier: 1 | 2 | 3;
  confidence: number;
  strippedTerms: string[];
}

// Words to strip in Tier 2
const CONDITION_WORDS = [
  'mint', 'excellent', 'good', 'fair', 'poor', 'used', 'new',
  'like new', 'refurbished', 'damaged', 'broken', 'working',
  'tested', 'untested', 'for parts', 'as is', 'minor scratches',
  'major scratches', 'pristine', 'sealed', 'opened', 'nib', 'nwt',
];

const COLOR_WORDS = [
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange',
  'purple', 'pink', 'brown', 'gray', 'grey', 'silver', 'gold',
  'matte', 'glossy', 'metallic', 'chrome', 'rose gold', 'space gray',
];

const SUBJECTIVE_WORDS = [
  'vintage', 'antique', 'rare', 'collectible', 'limited edition',
  'special edition', 'authentic', 'genuine', 'original', 'retro',
  'classic', 'modern', 'unique', 'beautiful', 'gorgeous', 'amazing',
];

const MATERIAL_WORDS = [
  'stainless', 'steel', 'aluminum', 'plastic', 'ceramic', 'glass',
  'leather', 'fabric', 'cotton', 'polyester', 'wood', 'wooden',
  'metal', 'rubber', 'silicone',
];

export function broadenQuery(originalQuery: string): BroadenResult[] {
  const results: BroadenResult[] = [];

  // Tier 1: Original query
  results.push({
    query: originalQuery,
    tier: 1,
    confidence: 1.0,
    strippedTerms: [],
  });

  // Tier 2: Strip condition, color, subjective terms
  const tier2Stripped: string[] = [];
  let tier2Query = originalQuery.toLowerCase();

  [...CONDITION_WORDS, ...COLOR_WORDS, ...SUBJECTIVE_WORDS].forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(tier2Query)) {
      tier2Stripped.push(word);
      tier2Query = tier2Query.replace(regex, '');
    }
  });

  // Clean up extra spaces
  tier2Query = tier2Query.replace(/\s+/g, ' ').trim();

  if (tier2Query !== originalQuery.toLowerCase() && tier2Query.length > 5) {
    results.push({
      query: tier2Query,
      tier: 2,
      confidence: 0.85,
      strippedTerms: tier2Stripped,
    });
  }

  // Tier 3: Strip materials, keep only brand + product type
  let tier3Query = tier2Query;
  const tier3Stripped = [...tier2Stripped];

  MATERIAL_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(tier3Query)) {
      tier3Stripped.push(word);
      tier3Query = tier3Query.replace(regex, '');
    }
  });

  // Also strip size/capacity indicators for Tier 3
  tier3Query = tier3Query
    .replace(/\b\d+\s*(oz|ml|l|lb|kg|inch|in|cm|mm)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (tier3Query !== tier2Query && tier3Query.length > 3) {
    results.push({
      query: tier3Query,
      tier: 3,
      confidence: 0.70,
      strippedTerms: tier3Stripped,
    });
  }

  return results;
}

// Integration with eBay search
export async function searchWithFallback(
  originalQuery: string,
  searchFunction: (query: string) => Promise<{ results: any[]; total: number }>,
  minResults: number = 3
): Promise<{
  results: any[];
  total: number;
  usedQuery: string;
  tier: number;
  confidence: number;
  broadened: boolean;
}> {
  const queries = broadenQuery(originalQuery);

  for (const { query, tier, confidence } of queries) {
    const { results, total } = await searchFunction(query);

    if (results.length >= minResults) {
      return {
        results,
        total,
        usedQuery: query,
        tier,
        confidence,
        broadened: tier > 1,
      };
    }
  }

  // If all tiers fail, return whatever we got from Tier 3
  const lastQuery = queries[queries.length - 1];
  const { results, total } = await searchFunction(lastQuery.query);

  return {
    results,
    total,
    usedQuery: lastQuery.query,
    tier: lastQuery.tier,
    confidence: lastQuery.confidence * 0.5, // Penalty for no results
    broadened: true,
  };
}
```

---

### 7.3 Velocity Override Logic

```typescript
// lib/vest/grade-override.ts

interface OverrideResult {
  originalGrade: string;
  originalScore: number;
  finalGrade: string;
  finalScore: number;
  overrideApplied: boolean;
  overrideReason: string | null;
}

interface OverrideInput {
  score: number;
  grade: string;
  daysToSell: number;
  netProfit: number;
  grossMargin: number;
  sellThroughRate: number;
}

// Grade hierarchy for comparison
const GRADE_VALUES: Record<string, number> = {
  'A+': 17, 'A': 16, 'A-': 15,
  'B+': 14, 'B': 13, 'B-': 12,
  'C+': 11, 'C': 10, 'C-': 9,
  'D+': 8, 'D': 7, 'D-': 6,
  'F+': 5, 'F': 4, 'F-': 3,
};

const GRADE_FROM_VALUE: Record<number, string> = Object.fromEntries(
  Object.entries(GRADE_VALUES).map(([k, v]) => [v, k])
);

// Override rules in priority order
interface OverrideRule {
  name: string;
  condition: (input: OverrideInput) => boolean;
  minimumGrade: string;
  reason: string;
}

const OVERRIDE_RULES: OverrideRule[] = [
  {
    name: 'CASH_FLOW_KING',
    condition: (i) => i.daysToSell <= 3 && i.netProfit >= 5,
    minimumGrade: 'B',
    reason: 'Ultra-fast velocity (≤3 days) with profit ≥$5',
  },
  {
    name: 'VELOCITY_CHAMPION',
    condition: (i) => i.daysToSell <= 7 && i.netProfit >= 10,
    minimumGrade: 'B+',
    reason: 'Fast velocity (≤7 days) with strong profit ≥$10',
  },
  {
    name: 'VELOCITY_STANDARD',
    condition: (i) => i.daysToSell <= 10 && i.netProfit >= 10,
    minimumGrade: 'B-',
    reason: 'Good velocity (≤10 days) with profit ≥$10',
  },
  {
    name: 'HIGH_MARGIN_PLAY',
    condition: (i) => i.grossMargin >= 0.50 && i.netProfit >= 25,
    minimumGrade: 'B+',
    reason: 'Exceptional margin (≥50%) with profit ≥$25',
  },
  {
    name: 'HOT_MARKET',
    condition: (i) => i.sellThroughRate >= 0.60 && i.netProfit >= 8,
    minimumGrade: 'B-',
    reason: 'Hot market (≥60% sell-through) with decent profit',
  },
  {
    name: 'QUICK_FLIP',
    condition: (i) => i.daysToSell <= 5 && i.netProfit >= 5 && i.grossMargin >= 0.30,
    minimumGrade: 'B-',
    reason: 'Quick flip opportunity with acceptable margins',
  },
];

export function applyGradeOverride(input: OverrideInput): OverrideResult {
  const originalGradeValue = GRADE_VALUES[input.grade] ?? 0;

  let bestOverride: { grade: string; reason: string } | null = null;
  let bestGradeValue = originalGradeValue;

  // Find the best applicable override
  for (const rule of OVERRIDE_RULES) {
    if (rule.condition(input)) {
      const ruleGradeValue = GRADE_VALUES[rule.minimumGrade];

      // Only apply if it would improve the grade
      if (ruleGradeValue > bestGradeValue) {
        bestGradeValue = ruleGradeValue;
        bestOverride = {
          grade: rule.minimumGrade,
          reason: `${rule.name}: ${rule.reason}`,
        };
      }
    }
  }

  if (bestOverride && bestGradeValue > originalGradeValue) {
    // Calculate adjusted score that matches the new grade
    // Grade boundaries: A+ >= 95, A >= 90, A- >= 87, etc.
    const adjustedScore = Math.max(input.score, gradeToMinScore(bestOverride.grade));

    return {
      originalGrade: input.grade,
      originalScore: input.score,
      finalGrade: bestOverride.grade,
      finalScore: adjustedScore,
      overrideApplied: true,
      overrideReason: bestOverride.reason,
    };
  }

  return {
    originalGrade: input.grade,
    originalScore: input.score,
    finalGrade: input.grade,
    finalScore: input.score,
    overrideApplied: false,
    overrideReason: null,
  };
}

function gradeToMinScore(grade: string): number {
  const scores: Record<string, number> = {
    'A+': 95, 'A': 90, 'A-': 87,
    'B+': 83, 'B': 80, 'B-': 77,
    'C+': 73, 'C': 70, 'C-': 67,
    'D+': 63, 'D': 60, 'D-': 57,
    'F+': 50, 'F': 40, 'F-': 0,
  };
  return scores[grade] ?? 0;
}
```

---

### 7.4 Sell-Through Rate Estimation

```typescript
// lib/vest/sell-through.ts

interface SellThroughInput {
  demandLevel: 'high' | 'medium' | 'low';
  activeListingCount: number;
  aiPriceEstimate: number;
  ebayMedianPrice: number;
}

interface SellThroughResult {
  estimatedRate: number;      // 0-1
  marketType: 'sellers' | 'balanced' | 'buyers';
  pricingStrategy: 'aggressive' | 'moderate' | 'conservative';
  reasoning: string;
}

// Base STR by demand level
const DEMAND_BASE_STR: Record<string, number> = {
  high: 0.65,
  medium: 0.40,
  low: 0.20,
};

export function estimateSellThroughRate(input: SellThroughInput): SellThroughResult {
  let str = DEMAND_BASE_STR[input.demandLevel] ?? 0.40;
  const adjustments: string[] = [];

  // Adjustment 1: Active listing density
  if (input.activeListingCount < 10) {
    str += 0.15;
    adjustments.push('+15% (scarcity: <10 listings)');
  } else if (input.activeListingCount > 50) {
    str -= 0.10;
    adjustments.push('-10% (saturated: >50 listings)');
  }

  // Adjustment 2: Price position
  const priceRatio = input.aiPriceEstimate / input.ebayMedianPrice;

  if (priceRatio < 0.8) {
    str += 0.10;
    adjustments.push('+10% (priced below market)');
  } else if (priceRatio > 1.2) {
    str -= 0.10;
    adjustments.push('-10% (priced above market)');
  }

  // Clamp to valid range
  str = Math.max(0.05, Math.min(0.95, str));

  // Determine market type
  let marketType: 'sellers' | 'balanced' | 'buyers';
  let pricingStrategy: 'aggressive' | 'moderate' | 'conservative';

  if (str > 0.50) {
    marketType = 'sellers';
    pricingStrategy = 'aggressive';
  } else if (str >= 0.30) {
    marketType = 'balanced';
    pricingStrategy = 'moderate';
  } else {
    marketType = 'buyers';
    pricingStrategy = 'conservative';
  }

  return {
    estimatedRate: Math.round(str * 100) / 100,
    marketType,
    pricingStrategy,
    reasoning: `Base: ${DEMAND_BASE_STR[input.demandLevel] * 100}% (${input.demandLevel} demand). ${adjustments.join(', ') || 'No adjustments.'}`,
  };
}

// Apply STR to price selection
export function selectPriceByMarket(
  triangulatedPrices: { low: number; mid: number; high: number },
  sellThroughResult: SellThroughResult,
  activeMedianPrice: number
): {
  selectedPrice: number;
  priceSource: string;
} {
  switch (sellThroughResult.marketType) {
    case 'sellers':
      // Seller's market: buyers compete, use higher prices
      return {
        selectedPrice: Math.max(triangulatedPrices.mid, activeMedianPrice * 0.9),
        priceSource: 'Active median (seller\'s market)',
      };

    case 'balanced':
      // Balanced: use triangulated mid
      return {
        selectedPrice: triangulatedPrices.mid,
        priceSource: 'Triangulated mid (balanced market)',
      };

    case 'buyers':
      // Buyer's market: conservative, lean toward low
      return {
        selectedPrice: (triangulatedPrices.low + triangulatedPrices.mid) / 2,
        priceSource: 'Low-mid average (buyer\'s market)',
      };
  }
}
```

---

## Appendix A: Implementation Priority

### Phase 1: Algorithm Fixes (Week 1-2)
1. Implement Net Profit calculator with fee breakdown
2. Add Velocity Override rules to grade calculation
3. Implement Keyword Broadener for eBay searches
4. Add Sell-Through Rate estimation

### Phase 2: Transparency Features (Week 3-4)
1. Build Comps Gallery component
2. Add listing exclusion functionality
3. Implement real-time grade animation on slider

### Phase 3: UI Overhaul (Week 5-6)
1. Redesign results page with Profit Hero
2. Add Liquidity Gauge visualization
3. Implement AI Signals bullet format
4. Apply Bloomberg design system

### Phase 4: Technical Infrastructure (Week 7-8)
1. Implement offline queue with IndexedDB
2. Add progress stepper for latency masking
3. Build Seller View mode
4. Add "Find Price for Grade" feature

---

## Appendix B: Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Avg scan-to-decision time | Unknown | < 5 seconds | Analytics |
| User trust in estimates | Low (anecdotal) | 4.5/5 survey | In-app survey |
| Grade accuracy | D- for good items | Matches profit potential | Manual audit |
| Search success rate | ~60% (0-result fallback) | > 95% | API logs |
| Offline usage | 0% | 15% of scans | Analytics |
| Repeat usage (7-day) | Unknown | > 40% | Analytics |

---

*Document prepared for FlipFinder v2.0 development sprint*
