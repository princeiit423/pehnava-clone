export function filterRecordsByDate(records, filter, now = new Date()) {
  if (!filter || filter.period === "all") return records;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = null;
  let end = new Date(today);

  if (filter.period === "today") start = today;
  if (filter.period === "this_week") {
    start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  }
  if (filter.period === "this_month") start = new Date(today.getFullYear(), today.getMonth(), 1);
  if (filter.period === "this_year") start = new Date(today.getFullYear(), 0, 1);
  if (filter.period === "last_year") {
    start = new Date(today.getFullYear() - 1, 0, 1);
    end = new Date(today.getFullYear() - 1, 11, 31);
  }
  if (filter.period === "custom") {
    start = filter.start ? new Date(`${filter.start}T00:00:00`) : null;
    end = filter.end ? new Date(`${filter.end}T23:59:59.999`) : null;
  } else {
    end.setHours(23, 59, 59, 999);
  }

  return records.filter((record) => {
    const created = new Date(record.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    return (!start || created >= start) && (!end || created <= end);
  });
}
