var cmpPriority = (a, b)=>a.priority - b.priority;
var sortPriority = (arr)=>arr.sort(cmpPriority);

export { sortPriority };
