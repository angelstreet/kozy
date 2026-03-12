import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5002';

test.describe('Integration Status API', () => {
  test('GET /api/integration/status returns correct structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/integration/status`, {
      headers: {
        // Local dev auth header for testing
        'x-user-id': 'dev-user',
      },
    });
    
    // Should return 200 for dev-user
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    // Check top-level fields
    expect(body).toHaveProperty('app_id', 'kozy');
    expect(body).toHaveProperty('authenticated');
    expect(body).toHaveProperty('auth_mode');
    expect(body).toHaveProperty('exists');
    expect(body).toHaveProperty('local_user_id');
    expect(body).toHaveProperty('clerk_user_id');
    expect(body).toHaveProperty('onboarded');
    expect(body).toHaveProperty('available_features');
    expect(body).toHaveProperty('summary');
    
    // Summary should have counts
    expect(body.summary).toHaveProperty('has_properties');
    expect(body.summary).toHaveProperty('has_bookings');
    expect(body.summary).toHaveProperty('has_cleaning_tasks');
    expect(body.summary).toHaveProperty('has_smoobu_key');
    expect(body.summary).toHaveProperty('counts');
    expect(body.summary.counts).toHaveProperty('properties');
    expect(body.summary.counts).toHaveProperty('bookings');
    expect(body.summary.counts).toHaveProperty('tasks');
  });
});

test.describe('Integration Actions API', () => {
  test('GET /api/integration/actions returns manifest', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/integration/actions`);
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    // Check manifest structure
    expect(body).toHaveProperty('app_id', 'kozy');
    expect(body).toHaveProperty('name', 'Kozy');
    expect(body).toHaveProperty('description');
    expect(body).toHaveProperty('actions');
    expect(Array.isArray(body.actions)).toBe(true);
    
    // Check at least one action exists
    expect(body.actions.length).toBeGreaterThan(0);
    
    // Check action structure
    const action = body.actions[0];
    expect(action).toHaveProperty('id');
    expect(action).toHaveProperty('app_id', 'kozy');
    expect(action).toHaveProperty('description');
    expect(action).toHaveProperty('input_schema');
    expect(action).toHaveProperty('output_schema');
    expect(action).toHaveProperty('artifact_hint');
    expect(action).toHaveProperty('preferred_visualization');
    expect(action).toHaveProperty('open_in_app');
  });
});

test.describe('Integration Execute API', () => {
  test('POST /api/integration/execute/kozy.list_properties works', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/integration/execute/kozy.list_properties`, {
      headers: {
        'x-user-id': 'dev-user',
        'Content-Type': 'application/json',
      },
      data: {},
    });
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    // Check response structure
    expect(body).toHaveProperty('action_id', 'kozy.list_properties');
    expect(body).toHaveProperty('text_summary');
    expect(body).toHaveProperty('artifact_hint', 'table');
    expect(body).toHaveProperty('preferred_visualization', 'table');
    expect(body).toHaveProperty('open_in_app');
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('properties');
    expect(Array.isArray(body.data.properties)).toBe(true);
  });

  test('POST /api/integration/execute/kozy.get_property_occupancy works', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/integration/execute/kozy.get_property_occupancy`, {
      headers: {
        'x-user-id': 'dev-user',
        'Content-Type': 'application/json',
      },
      data: {},
    });
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    expect(body).toHaveProperty('action_id', 'kozy.get_property_occupancy');
    expect(body).toHaveProperty('artifact_hint', 'bar_chart');
    expect(body).toHaveProperty('preferred_visualization', 'bar_chart');
    expect(body.data).toHaveProperty('properties');
  });

  test('POST /api/integration/execute/kozy.list_upcoming_turnovers works', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/integration/execute/kozy.list_upcoming_turnovers`, {
      headers: {
        'x-user-id': 'dev-user',
        'Content-Type': 'application/json',
      },
      data: {},
    });
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    expect(body).toHaveProperty('action_id', 'kozy.list_upcoming_turnovers');
    expect(body).toHaveProperty('artifact_hint', 'timeline');
    expect(body.data).toHaveProperty('turnovers');
  });

  test('POST /api/integration/execute/kozy.get_cleaning_summary works', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/integration/execute/kozy.get_cleaning_summary`, {
      headers: {
        'x-user-id': 'dev-user',
        'Content-Type': 'application/json',
      },
      data: {},
    });
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    expect(body).toHaveProperty('action_id', 'kozy.get_cleaning_summary');
    expect(body).toHaveProperty('artifact_hint', 'stat_card');
    expect(body.data).toHaveProperty('summary');
    expect(body.data.summary).toHaveProperty('total_tasks');
    expect(body.data.summary).toHaveProperty('pending');
    expect(body.data.summary).toHaveProperty('confirmed');
    expect(body.data.summary).toHaveProperty('done');
  });

  test('POST /api/integration/execute with unknown action returns 404', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/integration/execute/unknown.action`, {
      headers: {
        'x-user-id': 'dev-user',
        'Content-Type': 'application/json',
      },
      data: {},
    });
    
    expect(response.status()).toBe(404);
    
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Unknown integration action');
  });
});
