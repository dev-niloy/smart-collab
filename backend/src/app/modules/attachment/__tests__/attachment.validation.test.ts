import {
  isAllowedMime,
  isWithinSizeLimit,
  safeFilename,
  MAX_ATTACHMENT_SIZE,
  FILENAME_MAX_LEN,
} from '../attachment.constant';

describe('attachment validation helpers', () => {
  it('accepts allowed mime types and rejects others', () => {
    expect(isAllowedMime('application/pdf')).toBe(true);
    expect(isAllowedMime('image/png')).toBe(true);
    expect(isAllowedMime('text/csv')).toBe(true);
    expect(isAllowedMime('application/x-msdownload')).toBe(false);
    expect(isAllowedMime('image/svg+xml')).toBe(false);
    expect(isAllowedMime('')).toBe(false);
  });

  it('rejects size 0 / negative / over MAX_ATTACHMENT_SIZE', () => {
    expect(isWithinSizeLimit(1)).toBe(true);
    expect(isWithinSizeLimit(MAX_ATTACHMENT_SIZE)).toBe(true);
    expect(isWithinSizeLimit(MAX_ATTACHMENT_SIZE + 1)).toBe(false);
    expect(isWithinSizeLimit(0)).toBe(false);
    expect(isWithinSizeLimit(-5)).toBe(false);
    expect(isWithinSizeLimit(Number.NaN)).toBe(false);
  });

  it('safeFilename strips path traversal segments', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('..\\..\\windows\\boot.ini')).toBe('boot.ini');
    expect(safeFilename('/abs/path/to/file.pdf')).toBe('file.pdf');
    expect(safeFilename('   .hidden   ')).toBe('hidden');
    expect(safeFilename('weird name!@#.txt')).toBe('weird_name___.txt');
  });

  it('safeFilename caps length and preserves extension', () => {
    const longStem = 'a'.repeat(FILENAME_MAX_LEN + 50);
    const out = safeFilename(`${longStem}.pdf`);
    expect(out.length).toBe(FILENAME_MAX_LEN);
    expect(out.endsWith('.pdf')).toBe(true);
  });
});
