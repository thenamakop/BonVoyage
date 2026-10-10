import { Link } from 'react-router';

export function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-4">
        <Link to="/" className="text-blue-700 underline">
          Back to the home page
        </Link>
      </p>
    </section>
  );
}
