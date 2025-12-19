export function stripHtml(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}
