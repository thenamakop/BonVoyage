import { Link } from 'react-router';
import { useDocumentTitle } from '../lib/use-document-title';

export function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <section>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-4">
        <Link to="/" className="text-brand-700 underline">
          Back to the home page
        </Link>
      </p>
    </section>
  );
}
