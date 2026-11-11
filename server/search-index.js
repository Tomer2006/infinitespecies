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
    // Trigram postings live in one flat array (CSR layout) and trigrams are
    // integers, not substrings: building per-name Sets of 3-character strings
    // for millions of names dominated server startup.
    this.charCodes = new Uint32Array(0x10000); // UTF-16 code unit -> 1-based alphabet code
    this.alphabetSize = 0;
    this.trigramBase = 0; // alphabet size + 1, fixed when the index is finalized
    this.trigramIds = new Map(); // packed trigram key -> dense trigram id
    this.postingOffsets = new Uint32Array(1);
    this.postings = new Uint32Array(0);
    this.cache = new Map();
    this.maxCacheEntries = options.maxCacheEntries || DEFAULT_CACHE_SIZE;
  }

  add(id, name) {
    const normalizedName = normalizeSearchQuery(name);
    this.namesById[id] = normalizedName;

    const charCodes = this.charCodes;
    const length = normalizedName.length;
    let firstPrefix = -1;
    let extraPrefixes = null;
    for (let index = 0; index < length; index++) {
      const unit = normalizedName.charCodeAt(index);
      if (!charCodes[unit]) charCodes[unit] = ++this.alphabetSize;

      // A word of two or more characters starts here: index it by its first two.
      if (unit === 32 || index + 1 >= length) continue;
      if (index > 0 && normalizedName.charCodeAt(index - 1) !== 32) continue;
      const next = normalizedName.charCodeAt(index + 1);
      if (next === 32) continue;
      const prefix = unit * 0x10000 + next;
      if (prefix === firstPrefix || extraPrefixes?.includes(prefix)) continue;
      if (firstPrefix < 0) firstPrefix = prefix;
      else (extraPrefixes ??= []).push(prefix);

      let bucket = this.wordPrefixBuckets.get(prefix);
      if (!bucket) {
        bucket = [];
        this.wordPrefixBuckets.set(prefix, bucket);
      }
      bucket.push(id);
    }
  }

  finalize() {
    for (const [prefixKey, bucket] of this.wordPrefixBuckets) {
      const prefix = String.fromCharCode(Math.floor(prefixKey / 0x10000), prefixKey % 0x10000);
      const matches = [];
      this.#collectMatches(bucket, prefix, MAX_RESULTS, matches);
      this.prefixTopMatches.set(prefix, matches);
    }
    this.wordPrefixBuckets.clear();

    // Pass 1 counts each trigram's names; pass 2 writes the ids into place.
    this.trigramBase = this.alphabetSize + 1;
    const counts = this.#scanTrigrams(null, null);
    const trigramCount = this.trigramIds.size;
    const offsets = new Uint32Array(trigramCount + 1);
    for (let trigram = 0; trigram < trigramCount; trigram++) {
      offsets[trigram + 1] = offsets[trigram] + counts[trigram];
    }
    this.postingOffsets = offsets;
    this.postings = new Uint32Array(offsets[trigramCount]);
    this.#scanTrigrams(offsets.slice(0, trigramCount), this.postings);
  }

  // Visits every distinct trigram of every name in id order. Without `postings`
  // it returns how many names contain each trigram; with it, it appends each
  // name's id to that trigram's slice, advancing `cursors`.
  #scanTrigrams(cursors, postings) {
    const { namesById, charCodes, trigramIds, trigramBase: base } = this;
    let counts = new Uint32Array(Math.max(1024, trigramIds.size));
    let lastSeenIn = new Uint32Array(counts.length); // dedupes repeats within one name

    for (let id = 1; id < namesById.length; id++) {
      const name = namesById[id];
      if (!name || name.length < 3) continue;
      let first = charCodes[name.charCodeAt(0)];
      let second = charCodes[name.charCodeAt(1)];
      for (let index = 2; index < name.length; index++) {
        const third = charCodes[name.charCodeAt(index)];
        const key = (first * base + second) * base + third;
        first = second;
        second = third;

        let trigram = trigramIds.get(key);
        if (trigram === undefined) {
          trigram = trigramIds.size;
          trigramIds.set(key, trigram);
          if (trigram >= counts.length) {
            counts = growUint32(counts);
            lastSeenIn = growUint32(lastSeenIn);
          }
        }
        if (lastSeenIn[trigram] === id) continue;
        lastSeenIn[trigram] = id;
        if (postings) postings[cursors[trigram]++] = id;
        else counts[trigram]++;
      }
    }
    return counts;
  }

  #trigramBucket(trigram) {
    const first = this.charCodes[trigram.charCodeAt(0)];
    const second = this.charCodes[trigram.charCodeAt(1)];
    const third = this.charCodes[trigram.charCodeAt(2)];
    if (!first || !second || !third) return null;
    const id = this.trigramIds.get((first * this.trigramBase + second) * this.trigramBase + third);
    if (id === undefined) return null;
    return this.postings.subarray(this.postingOffsets[id], this.postingOffsets[id + 1]);
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
      const buckets = [...uniqueTrigrams(query)].map(key => this.#trigramBucket(key))
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
      const bucket = this.#trigramBucket(trigram);
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

function growUint32(array) {
  const grown = new Uint32Array(array.length * 2);
  grown.set(array);
  return grown;
}

function insertBounded(results, candidate, limit, namesById) {
  // A full list only changes when the candidate beats its current last entry.
  if (results.length >= limit && compareMatches(candidate, results[results.length - 1], namesById) >= 0) return;
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
