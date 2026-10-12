import Link from 'next/link';

export default function NotFound() {
  return (
    <main className='grid min-h-screen place-items-center bg-background p-6 text-center'>
      <div><p className='font-mono text-xs text-muted-foreground'>404</p><h1 className='mt-3 font-display text-5xl'>Page not found.</h1><Link href='/' className='mt-8 inline-block border border-border bg-secondary px-4 py-2 text-sm'>Return to Jujistsu</Link></div>
    </main>
  );
}
