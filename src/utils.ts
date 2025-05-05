import { NextRequest } from 'next/server'
import { defaultLocale, locales } from '@/config'

export function getCurrentLocale(req: NextRequest): string {

  const locale = req.cookies.get('NEXT_LOCALE')?.value
  if (locale) return locale

  const acceptLanguage = req.headers.get('accept-language')
  if (!acceptLanguage) return defaultLocale
  
  const languages = acceptLanguage.split(',')
    .map(lang => {
      const [code, q = '1'] = lang.split(';q=')
      return {
        code: code.split('-')[0].toLowerCase(),
        q: parseFloat(q)
      }
    })
    .sort((a, b) => b.q - a.q) // Sort by quality value
  
  const match = languages.find(lang => locales.includes(lang.code as any))
  return match ? match.code : defaultLocale
}

export async function* mergeAsyncIterators(iterators: AsyncIterable<any>[]) {
  const readers = iterators.map(it => it[Symbol.asyncIterator]());
  const results = readers.map(reader => reader.next());

  while (readers.length > 0) {
    const { value, index } = await Promise.race(
      results.map((p, i) =>
        p.then(value => ({ value, index: i }))
      )
    );

    if (value.done) {
      readers.splice(index, 1);
      results.splice(index, 1);
      continue;
    }

    results[index] = readers[index].next();
    yield value.value;
  }
}