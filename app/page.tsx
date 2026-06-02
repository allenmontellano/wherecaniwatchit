import { redirect } from 'next/navigation'

export default function HomePage() {
  async function handleSearch(formData: FormData) {
    'use server'
    const q = formData.get('q')?.toString().trim()
    if (q) redirect(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <main>
      <h1>Where Can I Watch It?</h1>
      <form action={handleSearch}>
        <input name="q" type="text" placeholder="Search movies and TV shows..." required />
        <button type="submit">Search</button>
      </form>
    </main>
  )
}
