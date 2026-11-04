import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="container-content flex flex-1 flex-col justify-center py-32">
      <p className="mb-6 eyebrow">Page not found</p>
      <h1 className="max-w-2xl text-h1">The page you are looking for does not exist or has moved.</h1>
      <div className="mt-10">
        <ButtonLink href="/" variant="secondary">
          Return home
        </ButtonLink>
      </div>
    </main>
  );
}
