
import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect users to their dashboard page instead of a specific project
  redirect('/dashboard');
}
