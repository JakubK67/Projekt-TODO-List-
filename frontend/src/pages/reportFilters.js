export const filterTasks = (tasks, from, to, excludedPriorities, excludedStatuses) =>
  tasks.filter((task) => {
    if (!task.deadline) return false;
    if (from && task.deadline < from) return false;
    if (to && task.deadline > to) return false;
    if (excludedPriorities.includes(task.priority)) return false;
    if (excludedStatuses.includes(task.status)) return false;
    return true;
  });
