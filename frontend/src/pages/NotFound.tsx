import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4">
      <h1 className="text-6xl font-bold text-secondary-600">404</h1>
      <p className="text-secondary-500">Page not found.</p>
      <Link to="/" className="text-primary-600 hover:underline">
        Go home
      </Link>
    </div>
  );
}
