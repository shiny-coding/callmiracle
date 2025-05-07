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

export async function* mergeAsyncIterators(iterables: AsyncIterable<any>[]) {
  const iterators = iterables.map(iterable => iterable[Symbol.asyncIterator]())
  const nexts = iterators.map(iterator => iterator.next())

  while (nexts.length > 0) {
    // Wait for the first iterator to yield a value
    const { result, i } = await Promise.race(
      nexts.map((p, i) => p.then(result => ({ result, i })))
    )

    if (result.done) {
      // Remove this iterator and its promise
      iterators.splice(i, 1)
      nexts.splice(i, 1)
    } else {
      // Queue up the next value for this iterator
      nexts[i] = iterators[i].next()
      yield result.value
    }
  }
}