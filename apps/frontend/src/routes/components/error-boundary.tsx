import { useRouteError } from 'react-router';

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <div>
      <div>{JSON.stringify(error)}</div>
    </div>
  );
}
