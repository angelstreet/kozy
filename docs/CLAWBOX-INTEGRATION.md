# Kozy -> ClawBox / OpenClaw Integration

## Purpose

This document defines how `Kozy` should be integrated into ClawBox or OpenClaw.

The target is:
- answer short-term rental questions in text
- render useful artifacts when helpful
- offer `Open in Kozy`

## UX Rule

For Kozy integration, always use this order:

1. answer in text from Kozy API
2. render an artifact when useful
3. offer `Open in Kozy`

No iframe-first approach in v1.

## What Kozy Should Provide

Kozy should provide:
- shared Clerk support or equivalent local user mapping
- `GET /api/integration/status`
- a small curated action set
- artifact hints
- deep link targets

## Recommended File Structure In Kozy

```text
kozy/
  docs/
    CLAWBOX-INTEGRATION.md
  backend/
    src/
      routes/
        integration.ts
      integration/
        actions.ts
        manifest.ts
        normalize.ts
        deeplinks.ts
  tests/
    api/
      integration-status.test.ts
      integration-actions.test.ts
```

## Initial Curated Action Set

Start with:
- `kozy.list_properties`
- `kozy.get_property_detail`
- `kozy.get_property_occupancy`
- `kozy.list_upcoming_turnovers`
- `kozy.get_cleaning_summary`

## Action Guidance

### `kozy.list_properties`
- purpose: list user properties
- artifact hint: `table`
- open in app: `/properties`

### `kozy.get_property_detail`
- purpose: answer focused questions about one property
- artifact hint: `stat_card`
- open in app: `/properties/:id`

### `kozy.get_property_occupancy`
- purpose: occupancy rate and booking density
- artifact hint: `bar_chart`
- preferred visualization: `bar_chart`
- open in app: `/dashboard` or `/calendar`

### `kozy.list_upcoming_turnovers`
- purpose: next bookings and cleaning turnovers
- artifact hint: `timeline`
- preferred visualization: `timeline`
- open in app: `/calendar`

### `kozy.get_cleaning_summary`
- purpose: cleaning workload and coordination summary
- artifact hint: `stat_card`
- open in app: `/dashboard`

## Artifact Mapping

Initial mapping:
- properties -> `table`
- property detail -> `stat_card`
- occupancy -> `bar_chart`
- upcoming turnovers -> `timeline`
- cleaning summary -> `stat_card`

## Deep Link Targets

Initial deep links:
- `/dashboard`
- `/calendar`
- `/properties`
- `/properties/:id`

## What ClawBox / OpenClaw Should Expect

For each curated action, Kozy should eventually return a normalized shape like:
- `action_id`
- `text_summary`
- `artifact_hint`
- `preferred_visualization`
- `open_in_app`
- `data`

## Example User Questions

### Example 1
`Which property is the most booked this month?`

Expected:
- text answer
- occupancy comparison artifact
- `Open in Kozy`

### Example 2
`What are my next turnovers?`

Expected:
- text answer
- turnover timeline artifact
- `Open in Kozy`

## Real-User Validation Checklist

Validate with the real user:
- status endpoint finds the correct local user
- properties are returned correctly
- occupancy values match reality
- turnover timeline is correct
- `Open in Kozy` lands on the right screen

## Final Rule

Kozy should specialize in:
- property and booking data
- occupancy and turnover summaries
- suggested visualization metadata
- deep links

ClawBox/OpenClaw should own:
- final agent orchestration
- final artifact rendering
- final UX consistency
