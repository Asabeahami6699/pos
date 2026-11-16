import type{ DateRange } from '../types/index';

export const getTodayRange = (): DateRange => {
  const now = new Date();
  const timezoneOffset = -12 * 60;
  const adjustment = timezoneOffset * 60000;
  const adjustedNow = new Date(now.getTime() + adjustment);
  
  const startOfDay = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate());
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate());
  endOfDay.setHours(23, 59, 59, 999);
  
  const startUTC = new Date(startOfDay.getTime() - adjustment);
  const endUTC = new Date(endOfDay.getTime() - adjustment);
  
  return {
    from: startUTC.toISOString(),
    to: endUTC.toISOString()
  };
};

export const getYesterdayRange = (): DateRange => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfDay = new Date(yesterday);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(yesterday);
  endOfDay.setHours(23, 59, 59, 999);
  
  return {
    from: startOfDay.toISOString(),
    to: endOfDay.toISOString()
  };
};

export const getLast7DaysRange = (): DateRange => {
  const today = new Date();
  const lastWeek = new Date();
  lastWeek.setDate(today.getDate() - 6);
  lastWeek.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  
  return {
    from: lastWeek.toISOString(),
    to: endOfDay.toISOString()
  };
};

export const getThisMonthRange = (): DateRange => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  
  return {
    from: firstDay.toISOString(),
    to: endOfDay.toISOString()
  };
};

export const formatDateForDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};