import { nameDistance } from '../src/modules/taxon-names.js';

const DEFAULT_CACHE_SIZE = 500;
const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 20;

export function normalizeSearchQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_QUERY_LENGTH);
}

export function scoreSearchName(name, query, wordQuery = ` ${query}`) {
  if (!name || !query) return 0;
  if (name === query) return 1000 + Math.max(0, 100 - name.length);
  if (name.startsWith(query)) return 800 + Math.max(0, 100 - name.length);

  if (name.includes(wordQuery)) {
    return 600 + Math.max(0, 80 - name.length);
  }

  const position = name.indexOf(query);
  if (position >= 0) {
    return 400 + Math.max(0, 50 - position) + Math.max(0, 50 - name.length / 2);
  }

  return 0;
}

export class TaxonomySearchIndex {
  constructor(options = {}) {
    this.namesById = [];
    this.wordPrefixBuckets = new Map();
    this.prefixTopMatches = new Map();
    this.trigramCounts = new Map();
    this.trigramBuckets = new Map();
    this.cache = new Map();
    this.maxCacheEntries = options.maxCacheEntries || DEFAULT_CACHE_SIZE;
  }

  add(id, name) {
    const normalizedName = normalizeSearchQuery(name);
    this.namesById[id] = normalizedName;

    const prefixes = new Set();
    for (const word of normalizedName.split(' ')) {
      if (word.length >= 2) prefixes.add(word.slice(0, 2));
    }

    for (const prefix of prefixes) {
      let bucket = this.wordPrefixBuckets.get(prefix);
      if (!bucket) {
        bucket = [];
        this.wordPrefixBuckets.set(prefix, bucket);
      }
      bucket.push(id);
    }

    for (const trigram of uniqueTrigrams(normalizedName)) {
      this.trigramCounts.set(trigram, (this.trigramCounts.get(trigram) || 0) + 1);
    }
  }

  finalize() {
    for (const [prefix, bucket] of this.wordPrefixBuckets) {
      const matches = [];
      this.#collectMatches(bucket, prefix, MAX_RESULTS, matches);
      this.prefixTopMatches.set(prefix, matches);
    }
    this.wordPrefixBuckets.clear();

    const offsets = new Map();
    for (const [trigram, count] of this.trigramCounts) {
      this.trigramBuckets.set(trigram, new Uint32Array(count));
      offsets.set(trigram, 0);
    }

    for (let id = 1; id < this.namesById.length; id++) {
      if (!this.namesById[id]) continue;
      for (const trigram of uniqueTrigrams(this.namesById[id])) {
        const bucket = this.trigramBuckets.get(trigram);
        const offset = offsets.get(trigram);
        bucket[offset] = id;
        offsets.set(trigram, offset + 1);
      }
    }

    this.trigramCounts.clear();
  }

  search(rawQuery, rawLimit = MAX_RESULTS) {
    const query = normalizeSearchQuery(rawQuery);
    if (query.length < 2) return [];

    const limit = Math.max(1, Math.min(Number(rawLimit) || MAX_RESULTS, MAX_RESULTS));
    const cacheKey = `${query}|${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached;
    }

    const results = [];
    if (query.length === 2) {
      const prefixMatches = this.prefixTopMatches.get(query) || [];
      results.push(...prefixMatches.slice(0, limit));
    }

    const bucket = query.length >= 3 ? this.#smallestTrigramBucket(query) : null;
    if (bucket) this.#collectMatches(bucket, query, limit, results);

    if (!results.length && query.length >= 4) {
      const candidates = new Map();
      // Bound work independently of tree size; uncommon trigrams first.
      const buckets = [...uniqueTrigrams(query)].map(key => this.trigramBuckets.get(key))
        .filter(Boolean).sort((a, b) => a.length - b.length);
      let visited = 0;
      for (const ids of buckets) {
        for (const id of ids) {
          if (++visited > 50000) break;
          candidates.set(id, (candidates.get(id) || 0) + 1);
        }
        if (visited > 50000) break;
      }
      const maxDistance = query.length >= 8 ? 2 : 1;
      for (const [id] of [...candidates].sort((a, b) => b[1] - a[1]).slice(0, 300)) {
        const name = this.namesById[id];
        const distance = nameDistance(query, name, maxDistance);
        if (distance <= maxDistance) insertBounded(results, { id, score: 200 - distance * 25 }, limit, this.namesById);
      }
    }

    this.cache.set(cacheKey, results);
    if (this.cache.size > this.maxCacheEntries) {
      this.cache.delete(this.cache.keys().next().value);
    }
    return results;
  }

  #smallestTrigramBucket(query) {
    let smallest = null;
    for (const trigram of uniqueTrigrams(query)) {
      const bucket = this.trigramBuckets.get(trigram);
      if (!bucket) return null;
      if (!smallest || bucket.length < smallest.length) smallest = bucket;
    }
    return smallest;
  }

  #collectMatches(candidateIds, query, limit, results) {
    const wordQuery = ` ${query}`;
    for (const id of candidateIds) {
      const name = this.namesById[id];
      const score = scoreSearchName(name, query, wordQuery);
      if (score <= 0) continue;
      insertBounded(results, { id, score }, limit, this.namesById);
    }
  }

}

function uniqueTrigrams(value) {
  const trigrams = new Set();
  for (let index = 0; index <= value.length - 3; index++) {
    trigrams.add(value.slice(index, index + 3));
  }
  return trigrams;
}

function insertBounded(results, candidate, limit, namesById) {
  let low = 0;
  let high = results.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compareMatches(candidate, results[middle], namesById) < 0) high = middle;
    else low = middle + 1;
  }
  results.splice(low, 0, candidate);
  if (results.length > limit) results.pop();
}

function compareMatches(a, b, namesById) {
  if (b.score !== a.score) return b.score - a.score;
  const aName = namesById[a.id] || '';
  const bName = namesById[b.id] || '';
  if (aName < bName) return -1;
  if (aName > bName) return 1;
  return a.id - b.id;
}
