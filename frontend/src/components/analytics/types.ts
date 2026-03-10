export type AnalyticsTab = 'earnings' | 'performance' | 'quality' | 'reports';

export type AnalyticsPeriod = 'currentMonth' | 'next3m' | 'next6m' | `year-${number}`;

export type PropertySummaryRow = {
  id: number;
  name: string;
  color: string;
  bookings: number;
  nights: number;
  revenue: number;
  occupancy: number;
  cleaningCost: number;
  net: number;
  avgRate: number;
};

export type DistributionDatum = {
  name: string;
  value: number;
  color: string;
};

export type ChannelSummary = {
  key: string;
  label: string;
  color: string;
  bookings: number;
  nights: number;
  revenue: number;
  cancellations: number | null;
  cancellationRate: number | null;
};

export type RevenueHistogramRow = {
  key: string;
  month: string;
  total: number;
  [key: string]: string | number;
};

export type QualityMetric = {
  label: string;
  value: string;
  hint: string;
};
