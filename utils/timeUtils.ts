export const formatRelativeTime = (date: Date | string | number): string => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  if (diffSecs < 60) return 'Ahora';
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `Hoy, ${timeStr}`;
  if (diffDays === 1) return `Ayer, ${timeStr}`;
  if (diffDays < 7) return `${diffDays} d`;
  
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}, ${timeStr}`;
};

export const formatMessageTime = (date: Date | string | number): string => {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === d.toDateString();
  
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  if (isToday) return timeStr;
  if (isYesterday) return `Ayer, ${timeStr}`;
  
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}, ${timeStr}`;
};

export const formatFullDateTime = (date: Date | string | number): string => {
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
