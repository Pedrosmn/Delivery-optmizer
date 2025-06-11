export function Card({ children }) {
  return (
    <div className="rounded-xl shadow-md border border-gray-200 bg-white">
      {children}
    </div>
  );
}

export function CardContent({ children }) {
  return <div className="p-4">{children}</div>;
}
