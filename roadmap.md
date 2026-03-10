# Analytics Roadmap

Last updated: 2026-03-10

## Context

Current Kozy analytics now covers:

- occupancy
- average stay
- average rate
- net cashflow
- revenue distribution by property
- monthly revenue histogram
- property-level revenue / nights / cleaning / net

Compared with Smoobu, Airbnb host insights, and Booking.com partner analytics messaging, Kozy still lacks several analytics layers that matter for short-term rental operations.

## Gaps

### 1. Channel performance

Missing today:

- bookings by channel
- nights by channel
- revenue by channel
- cancellation rate by channel
- net revenue by channel after commissions

Why it matters:

- Smoobu explicitly highlights channel breakdowns for revenue/bookings and cancellations.
- Airbnb and Booking both push channel-aware performance and opportunity analysis.

### 2. Forward-looking revenue visibility

Missing today:

- upcoming payout forecast
- booked revenue vs projected revenue
- next 30/60/90 day on-the-books revenue
- future occupancy pace

Why it matters:

- Airbnb’s earnings dashboard includes projected earnings from upcoming bookings.
- Property managers need future cash visibility, not only historical reporting.

### 3. Benchmarking

Missing today:

- compare listing performance vs similar local listings
- occupancy benchmark vs market
- ADR benchmark vs market
- listing ranking inside portfolio

Why it matters:

- Airbnb professional hosting tools expose comparisons against similar listings in the area.
- This is one of the fastest ways to tell whether low performance is a pricing issue, a listing issue, or a demand issue.

### 4. Pricing and demand intelligence

Missing today:

- booking window / lead time
- pickup pace by month
- weekday vs weekend pricing performance
- discount effectiveness
- seasonality heatmap
- dynamic pricing recommendations

Why it matters:

- Airbnb highlights demand periods, discounts, and pricing tools.
- Smoobu’s dynamic pricing ecosystem and integrations emphasize demand, occupancy, and competitive pricing intelligence.

### 5. Listing quality and conversion

Missing today:

- conversion rate
- inquiry-to-booking rate
- calendar fill speed
- quality score by property
- review score trends

Why it matters:

- Airbnb Insights includes conversion, occupancy & rates, quality, and hosting progress.
- Revenue alone is too late; conversion and quality explain why revenue is moving.

### 6. Advanced operating metrics

Missing today:

- RevPAR
- gross vs net revenue split
- cleaning cost ratio
- maintenance / other opex ratio
- profit margin per property
- stay length mix
- repeat guest rate

Why it matters:

- These are standard operator metrics and make Kozy more useful for owners with multiple units.

### 7. Actionable recommendations

Missing today:

- “opportunity center” style suggestions
- low occupancy alerts
- pricing warnings
- gap-night suggestions
- minimum stay suggestions
- channel mix warnings

Why it matters:

- Booking.com has long positioned analytics together with an Opportunity Centre.
- Analytics become more useful when tied to recommended actions.

### 8. Reporting and exports

Missing today:

- downloadable CSV/PDF reports
- scheduled monthly owner report
- custom date range report
- property comparison export

Why it matters:

- Airbnb supports custom reporting and statements.
- Smoobu also emphasizes detailed views and reporting by property and date.

## Proposed Roadmap

## Phase 1: Must-have

- Channel performance cards and charts
- Gross vs net revenue everywhere
- Booking lead time / booking window
- Future booked revenue + next 90 days occupancy
- Custom date range selector
- CSV export

Expected value:

- immediately improves owner decision-making
- closes the biggest gap with Smoobu’s core analytics

## Phase 2: Revenue management

- pickup pace report
- month-over-month and year-over-year comparisons
- weekday vs weekend performance
- discount and min-stay effectiveness
- gap-night analytics
- alerting for low occupancy / weak forward bookings

Expected value:

- helps users actually improve revenue, not just read charts

## Phase 3: Benchmarking

- portfolio ranking by property
- occupancy / ADR / RevPAR benchmarking within portfolio
- market benchmark ingestion if a data source becomes available
- “similar properties” comparison view

Expected value:

- moves Kozy closer to Airbnb professional insights and revenue tools

## Phase 4: Recommendation layer

- recommendation feed on dashboard
- “raise price”, “lower price”, “open last-minute discount”, “tighten minimum stay”
- “property underperforming vs portfolio average”
- “high cleaning cost ratio”

Expected value:

- turns analytics into an operating assistant

## Suggested Scope To Discuss

If we want the best near-term ROI, I would scope this order:

1. Channel analytics
2. Future booked revenue and occupancy pace
3. Custom date range + export
4. Lead time / booking window
5. Pickup and month-over-month comparisons
6. Action recommendations

I would not start with market benchmarking unless we already know the external data source, because that can expand the project a lot.

## Suggested Metrics To Add

- Occupancy %
- ADR
- RevPAR
- Gross revenue
- Net revenue
- OTA commissions
- Cleaning costs
- Net margin
- Nights booked
- Average stay
- Lead time
- Cancellation rate
- Channel share
- Future booked revenue
- Future occupancy
- Pickup pace

## Source Notes

### Smoobu

- Smoobu analytics page mentions revenue generated, occupancy rates, total bookings, cancellations, channel breakdowns, filters by date/property, and invoices.
- Smoobu statistics/KPI content also highlights occupancy rate, average revenue, overnight stays, and cancellation rate.
- Smoobu pricing integrations emphasize dynamic pricing, market reports, and competitive intel.

Sources:

- https://support.smoobu.com/hc/en-us/articles/360015032739-Analytics-How-to-get-a-detail-of-income-or-bookings
- https://www.smoobu.com/en/statistics-kpis-vacation-rentals/
- https://support.smoobu.com/hc/en-us/articles/360021563139-Partner-Wheelhouse-BETA-Dynamic-pricing
- https://support.smoobu.com/hc/en-us/articles/21966779906834-Smoobu-Dynamic-Pricing-FAQ

### Airbnb

- Airbnb earnings dashboard exposes interactive earnings charts, monthly/yearly views, next months projections, performance stats like nights booked and average length of stay, and custom reports.
- Airbnb professional hosting tools expose Insights with conversion, occupancy & rates, quality, and hosting progress, plus comparisons against similar listings.

Sources:

- https://www.airbnb.com/resources/hosting-homes/a/get-valuable-insights-in-the-earnings-dashboard-675
- https://www.airbnb.com/help/article/2500
- https://www.airbnb.com/help/article/2716
- https://www.airbnb.com/resources/hosting-homes/a/turning-high-demand-into-high-earnings-703

### Booking.com

- Public official Booking.com partner material accessible without partner login is more limited, but Booking has explicitly described Analytics together with Opportunity Centre as actionable, real-time business guidance.

Source:

- https://news.booking.com/en/bookingcoms-analytics-and-opportunity-centre/
