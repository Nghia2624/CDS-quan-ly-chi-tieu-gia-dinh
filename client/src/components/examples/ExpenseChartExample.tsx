import { ExpenseChart } from '../ExpenseChart';

export default function ExpenseChartExample() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      <ExpenseChart type="monthly" />
      <ExpenseChart type="category" />
    </div>
  );
}