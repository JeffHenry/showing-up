import { Outlet } from 'react-router';

/** Narrow, centered column for the sign-in pages. */
export function AuthLayout() {
  return (
    <div className="mx-auto w-full max-w-sm py-4 sm:py-10">
      <Outlet />
    </div>
  );
}
