export function formatCivilDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value ?? '';
}
