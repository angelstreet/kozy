# Kozy API Documentation

## Integration Endpoints

Kozy provides integration endpoints for ClawBox/OpenClaw integration.

### GET /api/integration/status

Returns integration/connection status for the authenticated user.

**Headers:**
- `x-user-id` - User ID for local auth (dev mode)

**Response:**
```json
{
  "app_id": "kozy",
  "authenticated": true,
  "auth_mode": "local|clerk",
  "exists": true,
  "local_user_id": "dev-user",
  "clerk_user_id": null,
  "onboarded": true,
  "available_features": ["properties", "occupancy", "turnovers", "cleaning", "smoobu_sync"],
  "summary": {
    "has_properties": true,
    "has_bookings": true,
    "has_cleaning_tasks": true,
    "has_smoobu_key": false,
    "counts": {
      "properties": 5,
      "bookings": 12,
      "tasks": 8
    }
  }
}
```

### GET /api/integration/actions

Returns the integration manifest with available actions.

**Response:**
```json
{
  "app_id": "kozy",
  "name": "Kozy",
  "description": "Short-term rental property and cleaning coordination for ClawBox/OpenClaw.",
  "actions": [
    {
      "id": "kozy.list_properties",
      "app_id": "kozy",
      "description": "List the properties visible to the current Kozy user.",
      "input_schema": {},
      "output_schema": { "type": "object", "properties": { "properties": { "type": "array" } } },
      "artifact_hint": "table",
      "preferred_visualization": "table",
      "open_in_app": "/properties"
    },
    ...
  ]
}
```

### POST /api/integration/execute/:actionId

Execute an integration action.

**Headers:**
- `x-user-id` - User ID for local auth (dev mode)
- `Content-Type: application/json`

**Body:** Action input (varies by action)

**Response:**
```json
{
  "action_id": "kozy.list_properties",
  "text_summary": "Found 5 visible property(ies).",
  "artifact_hint": "table",
  "preferred_visualization": "table",
  "open_in_app": "/properties",
  "data": {
    "properties": [...]
  }
}
```

## Available Actions

| Action ID | Description | Artifact Hint | Open In App |
|-----------|-------------|---------------|-------------|
| `kozy.list_properties` | List user properties | table | /properties |
| `kozy.get_property_occupancy` | Occupancy metrics for current month | bar_chart | /dashboard |
| `kozy.list_upcoming_turnovers` | Upcoming booking turnovers | timeline | /calendar |
| `kozy.get_cleaning_summary` | Cleaning tasks summary | stat_card | /dashboard |

## Errors

- 401 Unauthorized - No user authenticated
- 404 Not Found - Unknown action ID
