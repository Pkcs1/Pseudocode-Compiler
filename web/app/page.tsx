import { Workspace } from "@/components/sandbox/workspace";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-100 dark:bg-neutral-950 dark:text-neutral-100 transition-colors p-4 sm:p-6 lg:p-8">
      <Workspace />
    </div>
  );
}
