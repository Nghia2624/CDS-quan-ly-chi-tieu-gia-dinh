import { ExpenseForm } from '../ExpenseForm';

export default function ExpenseFormExample() {
  return (
    <div className="max-w-md mx-auto p-4">
      <ExpenseForm onSubmit={(expense) => console.log('Expense submitted:', expense)} />
    </div>
  );
}