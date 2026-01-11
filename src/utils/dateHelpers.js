import { eachWeekendOfInterval, format, isFriday, eachDayOfInterval, getDay } from 'date-fns';

export function parseLocalDate(dateStr) {
  // Parse YYYY-MM-DD to local midnight date
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDayLabel(dateStr) {
  const d = parseLocalDate(dateStr);
  // Formats like "Sat, Sep 15"
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function groupByMonth(dates) {
  return dates.reduce((acc, dateStr) => {
    const d = parseLocalDate(dateStr);
    const key = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(dateStr);
    return acc;
  }, {});
}

export function getSeasonWeekends(year) {
  const start = new Date(year, 2, 1); // March 1
  const end = new Date(year, 10, 30); // Nov 30
  
  // Ensure we exclude Fridays even if weekend definition varies
  const weekends = eachWeekendOfInterval({ start, end }).filter(d => !isFriday(d));
  const dates = weekends.map(d => format(d, 'yyyy-MM-dd'));
  return { dates };
}

export function getHolidays(year) {
  const holidays = [
    { name: "New Year's Day", date: `${year}-01-01` },
    { name: "Independence Day", date: `${year}-07-04` },
    { name: "Christmas Day", date: `${year}-12-25` },
    { name: "Veterans Day", date: `${year}-11-11` },
  ];

  // Dynamic Holidays
  // Memorial Day: Last Monday in May
  const mayDays = eachDayOfInterval({ start: new Date(year, 4, 1), end: new Date(year, 4, 31) });
  const memorialDay = mayDays.reverse().find(d => getDay(d) === 1); // 1 is Monday
  if (memorialDay) holidays.push({ name: "Memorial Day", date: format(memorialDay, 'yyyy-MM-dd') });

  // Labor Day: First Monday in September
  const septDays = eachDayOfInterval({ start: new Date(year, 8, 1), end: new Date(year, 8, 30) });
  const laborDay = septDays.find(d => getDay(d) === 1);
  if (laborDay) holidays.push({ name: "Labor Day", date: format(laborDay, 'yyyy-MM-dd') });

  // Thanksgiving: 4th Thursday in November
  const novDays = eachDayOfInterval({ start: new Date(year, 10, 1), end: new Date(year, 10, 30) });
  const thursdays = novDays.filter(d => getDay(d) === 4); // 4 is Thursday
  if (thursdays.length >= 4) {
    holidays.push({ name: "Thanksgiving", date: format(thursdays[3], 'yyyy-MM-dd') });
  }
  
  return { holidays };
}

