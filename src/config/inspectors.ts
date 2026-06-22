export const INSPECTOR_OPTIONS = [
  { id: 'inspetor-1', nome: 'ALLAN HENNING' },
  { id: 'inspetor-2', nome: 'DANILLO UCHÔA' },
  { id: 'inspetor-3', nome: 'DAVID HILL' },
  { id: 'inspetor-4', nome: 'YWERNG SOUZA' },
] as const;

export type InspectorOption = (typeof INSPECTOR_OPTIONS)[number];
