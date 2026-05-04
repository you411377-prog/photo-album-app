/**
 * Date/time formatting utilities.
 */

export const formatYmd = (ms) => {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatHm = (ms) => {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

export const formatSeconds = (totalSec) => {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
};
