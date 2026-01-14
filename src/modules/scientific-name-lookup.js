/**
 * Scientific name lookup module
 * 
 * Provides functionality to look up scientific names from common names
 * using Wikipedia API and other sources.
 */

/**
 * Check if a query looks like a scientific name (Genus species format)
 * Scientific names typically have: first word capitalized, second word lowercase
 */
function looksLikeScientificName(query) {
  const trimmed = query.trim();
  if (!trimmed) return false;
  
  const words = trimmed.split(/\s+/);
  
  // Scientific names are typically 2-3 words
  if (words.length < 2 || words.length > 3) {
    return false;
  }
  
  // First word should be capitalized (Genus)
  if (!/^[A-Z][a-z]+$/.test(words[0])) {
    return false;
  }
  
  // Second word should be lowercase (species)
  if (!/^[a-z]+$/.test(words[1])) {
    return false;
  }
  
  // Third word (if present) should be lowercase (subspecies/variety)
  if (words.length === 3 && !/^[a-z]+$/.test(words[2])) {
    return false;
  }
  
  return true;
}

/**
 * Extract scientific name from Wikipedia infobox or article text
 */
function extractScientificNameFromWikipedia(data) {
  if (!data || !data.query || !data.query.pages) {
    return null;
  }
  
  const pages = Object.values(data.query.pages);
  if (pages.length === 0) return null;
  
  const page = pages[0];
  
  // Try to extract from extract/text content
  if (page.extract) {
    const extract = page.extract;
    
    // Improved patterns for extracting scientific names
    const patterns = [
      // "Binomial name: Genus species" or "Scientific name: Genus species"
      /(?:Binomial name|Scientific name)[:\s]+([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)/i,
      // "Genus species (common name)" format - more flexible
      /([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s*\([^)]*\)/,
      // "Genus species is a species" format
      /([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s+is\s+(?:a|an)\s+(?:species|subspecies|genus)/i,
      // Scientific name at start of sentence
      /^([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s*\(/,
      // "The Genus species" format
      /(?:The|A|An)\s+([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s+is/i,
      // Look for any scientific name pattern in the first few sentences
      /\b([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\b/,
    ];
    
    for (const pattern of patterns) {
      const matches = extract.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
      for (const match of matches) {
        if (match && match[1]) {
          const candidate = match[1].trim();
          // Filter out common false positives
          if (candidate.length > 3 && 
              !['The', 'This', 'That', 'These', 'Those'].includes(candidate.split(' ')[0]) &&
              looksLikeScientificName(candidate)) {
            return candidate;
          }
        }
      }
    }
  }
  
  // Try to get from page title if it looks like a scientific name
  if (page.title && looksLikeScientificName(page.title)) {
    return page.title;
  }
  
  return null;
}

/**
 * Look up scientific name from common name using Wikipedia API
 * @param {string} commonName - The common name to look up
 * @returns {Promise<string|null>} - The scientific name if found, null otherwise
 */
export async function lookupScientificName(commonName) {
  if (!commonName || !commonName.trim()) {
    return null;
  }
  
  const query = commonName.trim();
  
  // Skip if it already looks like a scientific name
  if (looksLikeScientificName(query)) {
    return null;
  }
  
  try {
    // First, try Wikidata API which is more reliable for scientific names
    // Search for the entity using the common name
    const wikidataSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&search=${encodeURIComponent(query)}&type=item&origin=*`;
    const wikidataSearchResponse = await fetch(wikidataSearchUrl);
    
    if (wikidataSearchResponse.ok) {
      const searchData = await wikidataSearchResponse.json();
      console.log(`Wikidata search for "${query}": found ${searchData.search?.length || 0} results`);
      if (searchData.search && searchData.search.length > 0) {
        const queryLower = query.toLowerCase();
        // Try more results (up to 5) for better matching
        for (let i = 0; i < Math.min(5, searchData.search.length); i++) {
          const entityId = searchData.search[i].id;
          const entityLabel = searchData.search[i].label?.toLowerCase() || '';
          const entityDescription = searchData.search[i].description?.toLowerCase() || '';
          
          console.log(`Checking Wikidata entity ${i + 1}: "${searchData.search[i].label}" (${entityId})`);
          
          // More lenient matching: check if label matches query (exact or contains)
          const labelMatches = entityLabel === queryLower || 
                               entityLabel.includes(queryLower) || 
                               queryLower.includes(entityLabel);
          const descMatches = entityDescription.includes(queryLower);
          
          // Get the entity data
          const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${entityId}&props=claims|labels&origin=*`;
          const entityResponse = await fetch(entityUrl);
          
          if (entityResponse.ok) {
            const entityData = await entityResponse.json();
            const entity = entityData.entities?.[entityId];
            
            if (entity) {
              // Try to get scientific name (P225 = taxon name)
              if (entity.claims?.P225) {
                const taxonName = entity.claims.P225[0]?.mainsnak?.datavalue?.value;
                console.log(`  Found P225 (taxon name): ${taxonName}`);
                if (taxonName && looksLikeScientificName(taxonName)) {
                  // If label matches exactly or closely, return immediately
                  if (labelMatches || descMatches) {
                    console.log(`Found scientific name via Wikidata (label match): ${taxonName} for ${query}`);
                    return taxonName;
                  }
                  // Even if label doesn't match perfectly, if it's in top 2 results, consider it
                  if (i < 2) {
                    console.log(`Found scientific name via Wikidata (top result): ${taxonName} for ${query}`);
                    return taxonName;
                  }
                }
              }
              
              // Also check P1843 (taxon common name) to verify match
              if (entity.claims?.P1843) {
                const commonNames = entity.claims.P1843.map(c => {
                  const value = c.mainsnak?.datavalue?.value;
                  // Handle both string values and object values (monolingual text)
                  if (typeof value === 'string') {
                    return value.toLowerCase();
                  } else if (value && typeof value === 'object' && value.text) {
                    return value.text.toLowerCase();
                  }
                  return '';
                }).filter(cn => cn.length > 0);
                console.log(`  Found P1843 (common names): ${commonNames.join(', ')}`);
                const queryWords = queryLower.split(/\s+/);
                // Check if any common name contains all words from the query
                const matchesCommonName = commonNames.some(cn => {
                  return queryWords.every(word => cn.includes(word)) || cn.includes(queryLower);
                });
                
                if (matchesCommonName || labelMatches || descMatches) {
                  // This entity matches our common name, try to get scientific name
                  if (entity.claims?.P225) {
                    const taxonName = entity.claims.P225[0]?.mainsnak?.datavalue?.value;
                    if (taxonName && looksLikeScientificName(taxonName)) {
                      console.log(`Found scientific name via Wikidata (verified): ${taxonName} for ${query}`);
                      return taxonName;
                    }
                  }
                }
              } else if (labelMatches || descMatches) {
                // Even without P1843, if label matches and we have P225, use it
                if (entity.claims?.P225) {
                  const taxonName = entity.claims.P225[0]?.mainsnak?.datavalue?.value;
                  if (taxonName && looksLikeScientificName(taxonName)) {
                    console.log(`Found scientific name via Wikidata (label match, no P1843): ${taxonName} for ${query}`);
                    return taxonName;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Fallback to Wikipedia API
    // First, try to get the page summary using REST API
    // For multi-word queries, try with underscores (Wikipedia page title format)
    let searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    let response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    // If that fails, try with underscores
    if (!response.ok && query.includes(' ')) {
      const queryWithUnderscores = query.replace(/\s+/g, '_');
      searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(queryWithUnderscores)}`;
      response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
    }
    
    let data = null;
    let pageTitle = query;
    
    if (response.ok) {
      data = await response.json();
      pageTitle = data.title || query;
      
      // Try to extract scientific name from the summary
      if (data.extract) {
        const extract = data.extract;
        
        // Improved patterns for extracting scientific names - try more aggressive patterns first
        const patterns = [
          // "Binomial name: Genus species" or "Scientific name: Genus species" - most reliable
          /(?:Binomial name|Scientific name)[:\s]+([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)/i,
          // "Genus species (common name)" format - check first 500 chars
          /([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s*\([^)]*\)/,
          // "Genus species is a species" format
          /([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s+is\s+(?:a|an)\s+(?:species|subspecies)/i,
          // Scientific name at start of sentence
          /^([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s*\(/,
          // "The Genus species" format
          /(?:The|A|An)\s+([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s+is/i,
        ];
        
        // Try first 500 characters for faster matching
        const shortExtract = extract.substring(0, 500);
        
        for (const pattern of patterns) {
          const match = shortExtract.match(pattern);
          if (match && match[1]) {
            const candidate = match[1].trim();
            if (looksLikeScientificName(candidate)) {
              console.log(`Found scientific name via Wikipedia extract: ${candidate} for ${query}`);
              return candidate;
            }
          }
        }
      }
      
      // Check if the page title itself is a scientific name
      if (looksLikeScientificName(pageTitle)) {
        console.log(`Found scientific name via page title: ${pageTitle} for ${query}`);
        return pageTitle;
      }
    }
    
    // If REST API didn't work or didn't find it, try using the search API to find the page
    if (!response.ok || !data || !looksLikeScientificName(pageTitle)) {
      const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&origin=*`;
      const searchResponse = await fetch(searchApiUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
          // Try each search result
          for (const result of searchData.query.search) {
            // Check if the title is a scientific name
            if (looksLikeScientificName(result.title)) {
              return result.title;
            }
            
            const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(result.title)}`;
            const pageResponse = await fetch(pageUrl);
            
            if (pageResponse.ok) {
              const pageData = await pageResponse.json();
              
              // Try to extract from the summary
              if (pageData.extract) {
                const extract = pageData.extract;
                const patterns = [
                  /(?:Binomial name|Scientific name)[:\s]+([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)/i,
                  /([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s+\([^)]*\)/,
                  /([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s+is\s+(?:a|an)\s+(?:species|subspecies)/i,
                  /^([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?)\s+\(/,
                ];
                
                for (const pattern of patterns) {
                  const match = extract.match(pattern);
                  if (match && match[1]) {
                    const candidate = match[1].trim();
                    if (looksLikeScientificName(candidate)) {
                      return candidate;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Try using the full page content API for more detailed extraction
    const fullPageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(pageTitle)}&origin=*`;
    const fullPageResponse = await fetch(fullPageUrl);
    
    if (fullPageResponse.ok) {
      const fullPageData = await fullPageResponse.json();
      const scientificName = extractScientificNameFromWikipedia(fullPageData);
      if (scientificName) {
        return scientificName;
      }
    }
    
    // Last resort: try getting Wikidata item from Wikipedia page
    try {
      const wikidataUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(pageTitle)}&origin=*`;
      const wikidataResponse = await fetch(wikidataUrl);
      
      if (wikidataResponse.ok) {
        const wikidataData = await wikidataResponse.json();
        const pages = wikidataData.query?.pages;
        if (pages) {
          const page = Object.values(pages)[0];
          const wikibaseItem = page?.pageprops?.wikibase_item;
          
          if (wikibaseItem) {
            // Try to get scientific name from Wikidata
            const wikidataEntityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${wikibaseItem}&props=claims&origin=*`;
            const entityResponse = await fetch(wikidataEntityUrl);
            
            if (entityResponse.ok) {
              const entityData = await entityResponse.json();
              const entities = entityData.entities?.[wikibaseItem];
              if (entities?.claims?.P225) { // P225 is "taxon name" property
                const taxonName = entities.claims.P225[0]?.mainsnak?.datavalue?.value;
                if (taxonName && looksLikeScientificName(taxonName)) {
                  console.log(`Found scientific name via Wikidata (from Wikipedia page): ${taxonName} for ${query}`);
                  return taxonName;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore Wikidata errors
      console.warn('Wikidata lookup error:', e);
    }
    
    console.warn(`Could not find scientific name for: ${query}`);
    console.log('Debug: Tried Wikidata search and Wikipedia API');
    return null;
  } catch (error) {
    console.warn('Failed to lookup scientific name:', error);
    console.error('Error details:', error);
    return null;
  }
}

/**
 * Check if a query is likely a common name (not a scientific name)
 */
export function isLikelyCommonName(query) {
  if (!query || !query.trim()) return false;
  
  const trimmed = query.trim();
  
  // If it looks like a scientific name, it's not a common name
  if (looksLikeScientificName(trimmed)) {
    return false;
  }
  
  // Common names are typically single words or short phrases
  // and don't follow the Genus species pattern
  return true;
}
