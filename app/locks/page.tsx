import { Locks } from "./locks";

export default function LocksPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold">Your locks</h1>
      <p className="mt-2 mb-8 text-foreground/70">
        Locks you can withdraw or that you created. The withdrawer can withdraw a lock once its
        unlock time has passed.
      </p>
      <Locks />
    </main>
  );
}
