import { redirect } from 'next/navigation';

export default function Home() {
  // In a real app, you might fetch the user's projects and redirect to the first one,
  // or to a dashboard/project creation page if they have no projects.
  // For this example, we'll redirect to a hardcoded project ID.
  redirect('/projects/1');
}
