import { describe, it, expect } from 'vitest'
import {
  extractCast,
  extractCreatorsTV,
  extractCreatorsMovie,
  extractNetworkTV,
  extractNetworkMovie,
  extractTVCertification,
  extractMovieCertification,
  extractOriginCountryTV,
  extractOriginCountryMovie,
  languageName,
} from './extract'

describe('tmdb extract', () => {
  it('extractCast takes top 6 by order', () => {
    const credits = {
      cast: [
        { name: 'B', order: 1 },
        { name: 'A', order: 0 },
        { name: 'C', order: 2 },
      ],
      crew: [],
    }
    expect(extractCast(credits)).toEqual(['A', 'B', 'C'])
  })
  it('extractCreatorsMovie picks directors', () => {
    expect(
      extractCreatorsMovie({
        cast: [],
        crew: [
          { name: 'Bong Joon-ho', job: 'Director' },
          { name: 'X', job: 'Editor' },
        ],
      })
    ).toEqual(['Bong Joon-ho'])
  })
  it('extractCreatorsTV maps created_by', () =>
    expect(extractCreatorsTV([{ name: 'Michael Schur' }])).toEqual(['Michael Schur']))
  it('extractNetworkTV first network', () =>
    expect(extractNetworkTV([{ name: 'NBC' }])).toBe('NBC'))
  it('extractNetworkMovie first company', () =>
    expect(extractNetworkMovie([{ name: 'CJ Entertainment' }])).toBe('CJ Entertainment'))
  it('extractTVCertification picks US', () =>
    expect(
      extractTVCertification({
        results: [
          { iso_3166_1: 'GB', rating: '15' },
          { iso_3166_1: 'US', rating: 'TV-14' },
        ],
      })
    ).toBe('TV-14'))
  it('extractMovieCertification picks US non-empty', () =>
    expect(
      extractMovieCertification({
        results: [
          { iso_3166_1: 'US', release_dates: [{ certification: '' }, { certification: 'R' }] },
        ],
      })
    ).toBe('R'))
  it('extractOriginCountryTV first code', () =>
    expect(extractOriginCountryTV(['US'])).toBe('United States'))
  it('extractOriginCountryMovie first name', () =>
    expect(extractOriginCountryMovie([{ iso_3166_1: 'KR', name: 'South Korea' }])).toBe('South Korea'))
  it('languageName maps iso', () => expect(languageName('en')).toBe('English'))
  it('returns null on empty', () => {
    expect(extractCast({ cast: [], crew: [] })).toBeNull()
    expect(extractNetworkTV([])).toBeNull()
    expect(extractTVCertification({ results: [] })).toBeNull()
    expect(extractCreatorsMovie(undefined)).toBeNull()
    expect(languageName(undefined)).toBeNull()
  })
})
