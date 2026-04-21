import { Rocket, Lock, Settings, LayoutPanelLeft, Award, ChartPie } from 'lucide-react';

export enum STEPS {
  INTRODUCTION = 'INTRODUCTION',
  SECURITY = 'SECURITY',
  SETTINGS = 'SETTINGS',
  BUDGETING_STRATEGY = 'BUDGETING_STRATEGY',
  APP = 'APP',
  SUMMARY = 'SUMMARY',
}

export function isStep(v: unknown): v is STEPS {
  return typeof v === 'string' && Object.values(STEPS).includes(v as STEPS);
}

export const STEPS_ICONS = {
  [STEPS.INTRODUCTION]: Rocket,
  [STEPS.SECURITY]: Lock,
  [STEPS.SETTINGS]: Settings,
  [STEPS.BUDGETING_STRATEGY]: ChartPie,
  [STEPS.APP]: LayoutPanelLeft,
  [STEPS.SUMMARY]: Award,
} as const;
