// Format hours to 2 decimal places, show '—' for null/zero
export function fmtHours(val) {
  if (val === null || val === undefined) return '—';
  return val.toFixed(2) + ' h';
}

// Format hours as a number with commas e.g. 5,012.40
export function fmtHoursNum(val) {
  if (val === null || val === undefined) return '—';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format a date/timestamp
export function fmtDate(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Smart datetime: "Today, 2:34 PM" / "Yesterday, 11:22 AM" / "Mar 28, 11:22 AM"
export function fmtSmartDateTime(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today, ${timeStr}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + timeStr;
}

// Format relative time e.g. "4 min ago", "2 days ago"
export function fmtRelative(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Clamp date to start/end of day
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Date range presets
export function getPresetRange(preset) {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'thisWeek': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case 'lastWeek': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() - 7);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { from: startOfDay(start), to: endOfDay(end) };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start, to: endOfDay(now) };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start, to: endOfDay(end) };
    }
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}
