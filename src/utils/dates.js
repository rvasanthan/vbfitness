import { eachDayOfInterval, isSaturday, isSunday, format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';

export const getSeasonWeekends = (year) => {
  const start = new Date(year, 2, 1); // March 1st (Month is 0-indexed)
  const end = new Date(year, 10, 30); // Nov 30th

  const days = eachDayOfInterval({ start, end });
  const weekends = days.filter(day => isSaturday(day) || isSunday(day));
  
  return weekends;
};

// Simple holiday calculation for US holidays in the playing season
export const getHolidays = (year) => {
  const holidays = [
    { date: new Date(year, 6, 4), name: "Independence Day" }, // July 4
    { date: new Date(year, 10, 11), name: "Veterans Day" }, // Nov 11
  ];

  // Dynamic Holidays
  // Memorial Day: Last Monday in May
  const mayDays = eachDayOfInterval({ start: new Date(year, 4, 1), end: new Date(year, 4, 31) });
  const memorialDay = mayDays.filter(d => d.getDay() === 1).pop();
  if (memorialDay) holidays.push({ date: memorialDay, name: "Memorial Day" });

  // Labor Day: First Monday in September
  const septDays = eachDayOfInterval({ start: new Date(year, 8, 1), end: new Date(year, 8, 30) });
  const laborDay = septDays.filter(d => d.getDay() === 1)[0];
  if (laborDay) holidays.push({ date: laborDay, name: "Labor Day" });

  return holidays;
};

export const getMonthGroupedWeekends = (year) => {
  const weekends = getSeasonWeekends(year);
  const grouped = {};

  weekends.forEach(date => {
    const monthKey = format(date, 'MMMM');
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(date);
  });

  return grouped;
};
