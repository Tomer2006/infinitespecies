// A small, deterministic vocabulary for instant everyday-name searches.
// Scientific names remain the identity; common names are display/search aliases.
export const commonTaxa = [
  ['Life', 'All life', 'כל החיים', []],
  ['Cellular Organisms', 'Cellular life', 'חיים תאיים', []],
  ['Eukaryota', 'Eukaryotes', 'איקריוטים', ['eukaryote']],
  ['Metazoa', 'Animals', 'בעלי חיים', []],
  ['Chloroplastida', 'Green plants', 'צמחים ירוקים', ['green plant']],
  ['Homo sapiens', 'Human', 'אדם', ['humans', 'people', 'human being', 'בני אדם']],
  ['Panthera leo', 'Lion', 'אריה', ['lions']],
  ['Panthera tigris', 'Tiger', 'טיגריס', ['tigers']],
  ['Felis catus', 'Domestic cat', 'חתול', ['cat', 'cats', 'house cat']],
  ['Canis lupus', 'Gray wolf', 'זאב', ['wolf', 'wolves', 'grey wolf']],
  ['Canis lupus familiaris', 'Domestic dog', 'כלב', ['dog', 'dogs', 'Canis familiaris']],
  ['Aves', 'Birds', 'עופות', ['bird', 'ציפור', 'ציפורים']],
  ['Mammalia', 'Mammals', 'יונקים', ['mammal']],
  ['Primates', 'Primates', 'פרימטים', ['primate']],
  ['Animalia', 'Animals', 'בעלי חיים', ['animal', 'Metazoa']],
  ['Fungi', 'Fungi', 'פטריות', ['fungus', 'mushrooms']],
  ['Quercus', 'Oaks', 'אלון', ['oak', 'oak tree', 'אלונים']],
  ['Quercus robur', 'English oak', 'אלון אנגלי', ['pedunculate oak']],
  ['Rosa', 'Roses', 'ורד', ['rose']],
  ['Helianthus annuus', 'Sunflower', 'חמנית', ['sunflowers']],
  ['Apis mellifera', 'Western honey bee', 'דבורת הדבש', ['honey bee', 'honeybee', 'דבורה']],
  ['Lepidoptera', 'Butterflies and moths', 'פרפראים', ['butterfly', 'butterflies', 'moth', 'moths', 'פרפר']],
  ['Danaus plexippus', 'Monarch butterfly', 'דנאית מלכותית', ['monarch']],
  ['Octopoda', 'Octopuses', 'תמנונים', ['octopus', 'תמנון']],
  ['Strigiformes', 'Owls', 'דורסי לילה', ['owl', 'ינשוף']],
  ['Spheniscidae', 'Penguins', 'פינגווינים', ['penguin', 'פינגווין']],
  ['Balaenoptera musculus', 'Blue whale', 'לווייתן כחול', ['blue whales']],
  ['Tursiops truncatus', 'Common bottlenose dolphin', 'דולפינן מצוי', ['bottlenose dolphin']],
  ['Loxodonta africana', 'African savanna elephant', 'פיל סוואנה אפריקני', ['african elephant']],
  ['Elephas maximus', 'Asian elephant', 'פיל אסייתי', ['indian elephant']],
  ['Ursus maritimus', 'Polar bear', 'דוב קוטב', ['polar bears']],
  ['Ailuropoda melanoleuca', 'Giant panda', 'פנדה ענקית', ['panda']],
  ['Giraffa camelopardalis', 'Giraffe', 'ג׳ירפה', ['giraffes']],
  ['Pan troglodytes', 'Chimpanzee', 'שימפנזה', ['chimp', 'chimpanzees']],
  ['Pan paniscus', 'Bonobo', 'בונובו', ['bonobos']],
  ['Gallus gallus', 'Red junglefowl', 'תרנגול בנקיבה', ['junglefowl']],
  ['Gallus gallus domesticus', 'Chicken', 'תרנגול', ['chickens', 'Gallus domesticus']],
  ['Anura', 'Frogs and toads', 'חסרי זנב', ['frog', 'frogs', 'toad', 'toads', 'צפרדע']],
  ['Testudines', 'Turtles', 'צבים', ['turtle', 'tortoise', 'tortoises', 'צב']],
  ['Insecta', 'Insects', 'חרקים', ['insect']],
  ['Arachnida', 'Arachnids', 'עכבישנים', ['arachnid']],
  ['Araneae', 'Spiders', 'עכבישים', ['spider', 'עכביש']],
  ['Formicidae', 'Ants', 'נמלים', ['ant', 'נמלה']],
  ['Escherichia coli', 'E. coli', 'אי קולי', ['e coli']],
  ['Saccharomyces cerevisiae', "Baker’s yeast", 'שמר האפייה', ['bakers yeast', 'baker yeast', 'brewers yeast']],
].map(([scientific, en, he, aliases]) => ({ scientific, en, he, aliases }));

export function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
}

// Optimal string alignment distance: accepts a swapped pair as one typo.
export function nameDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previousPrevious = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], previousPrevious[j - 2] + 1);
      }
    }
    previousPrevious = previous;
    previous = row;
  }
  return previous[b.length];
}

export function findCommonTaxa(value) {
  const query = normalizeName(value);
  if (query.length < 2) return [];
  const score = (taxon) => Math.max(...[taxon.scientific, taxon.en, taxon.he, ...taxon.aliases].map(alias => {
    const name = normalizeName(alias);
    if (name === query) return 100;
    if (name.startsWith(query)) return 80;
    if (name.includes(query)) return 60;
    const max = query.length >= 8 ? 2 : 1;
    if (query.length >= 4 && nameDistance(query, name, max) <= max) return 30;
    return 0;
  }));
  return commonTaxa.map(taxon => ({ taxon, score: score(taxon) }))
    .filter(match => match.score > 0).sort((a, b) => b.score - a.score)
    .slice(0, 5).map(match => match.taxon);
}

export function getCommonName(scientific, language = 'en') {
  const name = normalizeName(scientific);
  const taxon = commonTaxa.find(item => normalizeName(item.scientific) === name);
  return taxon?.[language] ?? null;
}
