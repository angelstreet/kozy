import db from '../db.js';
import { kozyDeeplink, kozyPropertyDeeplink } from './deeplinks.js';

export type KozyIntegrationActionId =
  | 'kozy.list_properties'
  | 'kozy.get_property_occupancy'
  | 'kozy.list_upcoming_turnovers'
  | 'kozy.get_cleaning_summary';

export type KozyIntegrationAction = {
  id: KozyIntegrationActionId;
  app_id: 'kozy';
  description: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  artifact_hint: string;
  preferred_visualization: string;
  open_in_app: string;
};

export const kozyIntegrationActions: KozyIntegrationAction[] = [
  {
    id: 'kozy.list_properties',
    app_id: 'kozy',
    description: 'List the properties visible to the current Kozy user.',
    input_schema: {},
    output_schema: { type: 'object', properties: { properties: { type: 'array' } } },
    artifact_hint: 'table',
    preferred_visualization: 'table',
    open_in_app: kozyDeeplink('/properties'),
  },
  {
    id: 'kozy.get_property_occupancy',
    app_id: 'kozy',
    description: 'Return occupancy metrics for visible properties in the current month.',
    input_schema: {},
    output_schema: { type: 'object', properties: { properties: { type: 'array' } } },
    artifact_hint: 'bar_chart',
    preferred_visualization: 'bar_chart',
    open_in_app: kozyDeeplink('/dashboard'),
  },
  {
    id: 'kozy.list_upcoming_turnovers',
    app_id: 'kozy',
    description: 'List upcoming booking turnovers for the visible properties.',
    input_schema: {},
    output_schema: { type: 'object', properties: { turnovers: { type: 'array' } } },
    artifact_hint: 'timeline',
    preferred_visualization: 'timeline',
    open_in_app: kozyDeeplink('/calendar'),
  },
  {
    id: 'kozy.get_cleaning_summary',
    app_id: 'kozy',
    description: 'Summarize cleaning tasks and pending workload.',
    input_schema: {},
    output_schema: { type: 'object', properties: { summary: { type: 'object' } } },
    artifact_hint: 'stat_card',
    preferred_visualization: 'stat_card',
    open_in_app: kozyDeeplink('/dashboard'),
  },
];

function visiblePropertiesWhereClause(userId: string) {
  return userId && userId !== 'dev-user'
    ? {
        where: 'WHERE (p.user_id = ? OR p.user_id IS NULL)',
        args: [userId] as string[],
      }
    : {
        where: '',
        args: [] as string[],
      };
}

function roundMoney(value: unknown) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export async function runKozyIntegrationAction(actionId: KozyIntegrationActionId, userId: string, input: Record<string, any> = {}) {
  switch (actionId) {
    case 'kozy.list_properties':
      return listProperties(userId);
    case 'kozy.get_property_occupancy':
      return getPropertyOccupancy(userId);
    case 'kozy.list_upcoming_turnovers':
      return listUpcomingTurnovers(userId);
    case 'kozy.get_cleaning_summary':
      return getCleaningSummary(userId, input);
  }
}

async function listProperties(userId: string) {
  const { where, args } = visiblePropertiesWhereClause(userId);
  const result = await db.execute({
    sql: `
      SELECT p.id, p.name, p.address, p.color, p.enabled, p.monthly_revenue, p.monthly_charges, p.credit_mensuel
      FROM property p
      ${where}
      ORDER BY p.name
    `,
    args,
  });

  const properties = (result.rows as any[]).map((p) => ({
    id: Number(p.id),
    name: p.name || '',
    address: p.address || null,
    color: p.color || null,
    enabled: Boolean(p.enabled),
    monthly_revenue: p.monthly_revenue != null ? roundMoney(p.monthly_revenue) : null,
    monthly_charges: p.monthly_charges != null ? roundMoney(p.monthly_charges) : null,
    credit_mensuel: p.credit_mensuel != null ? roundMoney(p.credit_mensuel) : null,
  }));

  return {
    action_id: 'kozy.list_properties',
    text_summary: properties.length === 0 ? 'No properties found.' : `Found ${properties.length} visible property(ies).`,
    artifact_hint: 'table',
    preferred_visualization: 'table',
    open_in_app: kozyDeeplink('/properties'),
    data: { properties },
  };
}

async function getPropertyOccupancy(userId: string) {
  const { where, args } = visiblePropertiesWhereClause(userId);
  const propResult = await db.execute({
    sql: `
      SELECT p.id, p.name, p.color, p.rate
      FROM property p
      ${where}
      AND p.enabled = 1
      ORDER BY p.name
    `.replace('\n      AND', where ? '\n      AND' : '\n      WHERE'),
    args,
  });
  const properties = propResult.rows as any[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const occupancy = await Promise.all(properties.map(async (p: any) => {
    const bookingsResult = await db.execute({ sql: 'SELECT * FROM booking WHERE property_id = ?', args: [p.id] });
    const bookings = bookingsResult.rows as any[];
    let bookedNights = 0;

    for (const b of bookings) {
      const cin = new Date(b.checkin_date);
      const cout = new Date(b.checkout_date);
      const start = cin < monthStart ? monthStart : cin;
      const end = cout > monthEnd ? monthEnd : cout;
      const nights = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      bookedNights += nights;
    }

    const ratePercent = daysInMonth > 0 ? Math.round((bookedNights / daysInMonth) * 100) : 0;

    return {
      id: Number(p.id),
      name: p.name || '',
      color: p.color || null,
      booked_nights: bookedNights,
      total_nights: daysInMonth,
      rate_percent: ratePercent,
    };
  }));

  const top = [...occupancy].sort((a, b) => b.rate_percent - a.rate_percent)[0] || null;

  return {
    action_id: 'kozy.get_property_occupancy',
    text_summary: top
      ? `${top.name} has the highest occupancy this month at ${top.rate_percent}%.`
      : 'No occupancy data found.',
    artifact_hint: 'bar_chart',
    preferred_visualization: 'bar_chart',
    open_in_app: kozyDeeplink('/dashboard'),
    data: { properties: occupancy },
  };
}

async function listUpcomingTurnovers(userId: string) {
  const { where, args } = visiblePropertiesWhereClause(userId);
  const result = await db.execute({
    sql: `
      SELECT b.id, b.property_id, b.checkin_date, b.checkout_date, b.guest_name, p.name as property_name, p.color as property_color
      FROM booking b
      JOIN property p ON p.id = b.property_id
      ${where}
      AND (b.status IS NULL OR b.status != 'cancelled')
      AND date(b.checkout_date) >= date('now')
      ORDER BY b.checkout_date ASC
      LIMIT 10
    `.replace('\n      AND', where ? '\n      AND' : '\n      WHERE'),
    args,
  });

  const turnovers = (result.rows as any[]).map((row) => ({
    booking_id: Number(row.id),
    property_id: Number(row.property_id),
    property_name: row.property_name || '',
    property_color: row.property_color || null,
    guest_name: row.guest_name || null,
    checkin_date: row.checkin_date || null,
    checkout_date: row.checkout_date || null,
  }));

  return {
    action_id: 'kozy.list_upcoming_turnovers',
    text_summary: turnovers.length === 0
      ? 'No upcoming turnovers found.'
      : `Found ${turnovers.length} upcoming turnover(s). The next one is for ${turnovers[0].property_name} on ${turnovers[0].checkout_date}.`,
    artifact_hint: 'timeline',
    preferred_visualization: 'timeline',
    open_in_app: kozyDeeplink('/calendar'),
    data: { turnovers },
  };
}

async function getCleaningSummary(userId: string, input: Record<string, any>) {
  const propertyId = input.property_id ? Number(input.property_id) : null;
  const { where, args } = visiblePropertiesWhereClause(userId);
  const sql = `
    SELECT ct.id, ct.status, ct.rate, ct.date, p.id as property_id, p.name as property_name
    FROM cleaning_task ct
    JOIN property p ON p.id = ct.property_id
    ${where}
    ${propertyId ? `${where ? 'AND' : 'WHERE'} p.id = ?` : ''}
  `;
  const result = await db.execute({
    sql,
    args: propertyId ? [...args, propertyId] : args,
  });

  const tasks = result.rows as any[];
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const confirmed = tasks.filter((t) => t.status === 'confirmed').length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const totalAmount = tasks.reduce((sum, t) => sum + Number(t.rate || 0), 0);
  const targetPropertyId = propertyId || (tasks[0] ? Number(tasks[0].property_id) : null);

  return {
    action_id: 'kozy.get_cleaning_summary',
    text_summary: tasks.length === 0
      ? 'No cleaning tasks found.'
      : `There are ${pending} pending, ${confirmed} confirmed, and ${done} completed cleaning task(s).`,
    artifact_hint: 'stat_card',
    preferred_visualization: 'stat_card',
    open_in_app: targetPropertyId ? kozyPropertyDeeplink(targetPropertyId) : kozyDeeplink('/dashboard'),
    data: {
      summary: {
        total_tasks: tasks.length,
        pending,
        confirmed,
        done,
        total_amount: roundMoney(totalAmount),
      },
    },
  };
}
