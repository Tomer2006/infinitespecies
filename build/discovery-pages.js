// Original editorial content. These pages introduce an exploration, rather than
// generating a thin page for every taxon. Keep sources beside the relevant text.
export const discoveryPages = [
  {
    path: '/tree-of-life/', title: 'Interactive Tree of Life: How to Explore Biological Taxonomy',
    heading: 'One map. Millions of connections.', label: 'A guide to the tree of life',
    description: 'Learn how to explore the tree of life with InfiniteSpecies: understand nested groups, find organisms, and follow their taxonomy in an interactive map.',
    target: 'all', action: 'Open the tree of life',
    sections: [
      ['What am I looking at?', 'InfiniteSpecies turns a biological taxonomy into a map of nested circles. A group contains its smaller groups, and you can move from broad branches to individual organisms. The hierarchy comes from Open Tree of Life taxonomy. The circle arrangement is a way to make that hierarchy explorable; it is not a timeline, a geographic map, or a measurement of genetic distance.'],
      ['Read the nesting, not the distance', 'Start with a large circle and look at the groups inside it. Enter one of those groups to focus on that branch. Two circles being near each other on screen does not, by itself, tell you how closely their organisms are related. Follow their containing groups and the navigation trail instead. Taxonomic classifications also change as knowledge develops; the map represents its loaded dataset, not every unresolved scientific question.'],
      ['Try a two-minute exploration', 'Open the map and search for human or Homo sapiens. Read the information card, then choose Back to see the containing group. Open See what’s inside to inspect the names in that branch. Next, reset the view and search for birds or Aves. Notice how the navigation trail changes. You can use the same approach with an organism you know from a garden, a park, or a biology lesson.'],
      ['Explore with a mouse, touch, or keyboard', 'Scroll or use the + and − buttons to change the zoom. Click a group to focus the branch; use Back or the trail to return. On a phone, pinch to zoom, drag to move, and tap a circle to explore it. Keyboard users can reach the search field and See what’s inside with Tab and activate controls with Enter. Pin a card if you want to keep reading while moving around.'],
      ['Take a discovery with you', 'Use the share button in the map to copy a link to the selected group or organism. Opening that link starts the map at its destination. For a reading page that works without loading the map, share one of the introductions below.'],
    ],
    sources: [['Open Tree of Life: project and taxonomy sources', 'https://tree.opentreeoflife.org/about/open-tree-of-life']],
  },
  {
    path: '/explore/humans/', title: 'Where Do Humans Fit in the Tree of Life? | Homo sapiens',
    heading: 'Find yourself in the tree of life.', label: 'Homo sapiens · Human',
    description: 'Explore Homo sapiens in the tree of life. Follow the human taxonomic branch, inspect containing groups, and compare it with other organisms in InfiniteSpecies.',
    target: 'Homo sapiens', action: 'Explore humans in the map',
    sections: [
      ['Our species has a place in a much larger tree', 'Homo sapiens is the species to which all living humans belong. Humans are primates, and within that group we belong to the great apes. This does not mean humans descended from the chimpanzees or gorillas living today: living species share ancestors. The Smithsonian Human Origins Program provides a deeper account of the fossil and biological evidence.'],
      ['Follow the branch outward', 'Open the map at Homo sapiens. The information card identifies the selected organism, while the trail across the top shows its position in the loaded taxonomy. Choose Back and open See what’s inside. Repeat the process to move toward broader containing groups. This is a way to investigate classification without having to memorize a long sequence of names before you begin.'],
      ['A small exploration challenge', 'After tracing the human branch outward, search for Pan troglodytes, the chimpanzee. Follow its containing groups and compare the names with the trail you saw for humans. Which named groups appear on both paths? Use the share button to save a destination you want to discuss. The map helps you inspect the taxonomy; consult the source material for dates and evidence about evolutionary relationships.'],
      ['What the picture does not tell you', 'The size and spacing of the circles are part of the layout. They do not measure intelligence, evolutionary progress, the age of a species, or genetic similarity. A nested taxonomy is a useful starting point for questions, but it is not a substitute for a dated evolutionary tree or a scientific study.'],
    ],
    sources: [['Smithsonian Human Origins Program: Homo sapiens', 'https://humanorigins.si.edu/evidence/human-fossils/species/homo-sapiens'], ['Open Tree of Life taxonomy', 'https://tree.opentreeoflife.org/about/open-tree-of-life']],
  },
  {
    path: '/explore/birds/', title: 'Explore the Bird Family Tree | Aves in the Tree of Life',
    heading: 'A familiar bird. A whole branch to explore.', label: 'Aves · Birds',
    description: 'Explore birds in the tree of life. Start at Aves, browse smaller groups, and find owls and penguins in the InfiniteSpecies interactive taxonomy map.',
    target: 'Aves', action: 'Explore birds in the map',
    sections: [
      ['Start with Aves', 'Aves is the scientific name used for the bird group. Opening this destination focuses the map on that part of the taxonomy. From there, you can enter smaller groups, search for a name, or move outward to see the groups that contain birds. You do not need to recognize every scientific name to start exploring.'],
      ['Turn familiar names into a route', 'Try searching for owls, then penguins. The search results show scientific names alongside supported common names: for example, Strigiformes for owls and Spheniscidae for penguins. These are groups, not individual species. Inspect the navigation trail and use See what’s inside to continue inward. When you reach an organism with an available Wikipedia entry, its card can show a photograph and a short introduction.'],
      ['Try this with a bird you have seen', 'Choose a bird from a walk or a garden. Find its name using a field guide, then search for it in the map. Trace its containing groups and compare the route with a second bird. A name may have synonyms or a different treatment in another source, so keep the scientific name with your notes. Cornell Lab’s All About Birds is a useful companion for learning about birds and identifying many North American species.'],
      ['Use the map for classification, a field guide for identification', 'An information-card image is a starting point for learning. It is not an identification tool, and a photograph may be missing. The map also does not show a bird’s range, abundance, or conservation status. Follow the source links when those details matter, and use the tree to ask how groups are organized.'],
    ],
    sources: [['Cornell Lab of Ornithology: All About Birds', 'https://www.birds.cornell.edu/home/all-about-birds/'], ['Open Tree of Life taxonomy', 'https://tree.opentreeoflife.org/about/open-tree-of-life']],
  },
  {
    path: '/explore/oaks/', title: 'Explore Oak Trees | Quercus in the Tree of Life',
    heading: 'Look beyond a single oak tree.', label: 'Quercus · Oaks',
    description: 'Discover Quercus, the oak genus, in the tree of life. Explore oak names, move between genus and species, and learn how to read the taxonomy map.',
    target: 'Quercus', action: 'Explore oaks in the map',
    sections: [
      ['A common name can describe a whole group', 'Oak is a familiar name, but it does not identify a single species. Quercus is the oak genus. Starting here gives you a group to explore rather than picking one oak species for you. Kew’s Plants of the World Online is a companion source for checking plant names and their taxonomic treatment.'],
      ['Move from genus to species', 'Open Quercus in the map and choose See what’s inside. Inspect the names beneath the genus, then select one to focus its place in the tree. You can also search directly for Quercus robur, the English oak. Compare a genus name with a two-part species name: the first part of Quercus robur tells you its genus.'],
      ['Try a comparison', 'Choose one oak entry and pin its information card. Move outward using Back, then inspect another entry from the branch. What changes in the name and description? Copy a link to return to either destination. If no photograph or description is available, you can still follow the taxonomy and use the web-search control to find more information.'],
      ['Names and boundaries can change', 'Plant names can have synonyms, and sources may use different classifications. A taxonomy map is a representation of the data it uses, not a guarantee that every source agrees on a name. Circle size does not show a tree’s height, its geographic range, or its abundance. Check a botanical reference for those questions.'],
    ],
    sources: [['Kew Plants of the World Online: Quercus', 'https://powo.science.kew.org/results?q=Quercus'], ['Open Tree of Life taxonomy', 'https://tree.opentreeoflife.org/about/open-tree-of-life']],
  },
  {
    path: '/about/', title: 'About InfiniteSpecies | Taxonomy Data, Sources and Feedback',
    heading: 'Built for curiosity about living things.', label: 'About InfiniteSpecies',
    description: 'Learn what InfiniteSpecies shows, where its taxonomy and species information come from, and how to report a problem or suggest an improvement.',
    target: 'all', action: 'Start exploring',
    sections: [
      ['What InfiniteSpecies does', 'InfiniteSpecies is a free interactive map for exploring biological taxonomy. It is designed to let a curious visitor move from broad groups to individual organisms, search names, and share a destination. The interface and introductory reading pages are in English.'],
      ['Where the data comes from', 'The map uses a processed Open Tree of Life taxonomy dataset arranged into nested circles. This is a visualization of taxonomy, not a display of the Open Tree synthetic phylogeny. The layout does not encode dates, genetic distances, conservation status, or geographic distributions. The data is a snapshot and may differ from other sources or from subsequent scientific revisions.'],
      ['Descriptions, photographs and names', 'Information cards request English-language summaries and thumbnails from Wikipedia, and taxonomic ranks from Wikidata when available. Source links accompany available summaries; Wikipedia text is shared under its applicable Creative Commons terms, while image credits and licenses can be checked through the linked source. Everyday-name search uses a small built-in vocabulary and may query GBIF when local searches have no results. Resolved names are only shown when their scientific name is found in the map. Coverage and agreement between sources are not complete.'],
      ['Your browser and external services', 'Your language, settings, and dismissed map tips are saved in this browser. The map loads data from its taxonomy service. Opening previews contacts Wikipedia and Wikidata; a fallback name search contacts GBIF. Those services receive the requested name and the usual connection information. This release does not add an analytics tracker or require an account to explore.'],
      ['Help make the next visit better', 'If a name looks wrong, a destination does not open, or a control is difficult to use, report it through the project issue tracker linked below. Include the shared map link, what you expected to happen, and your device or browser. A small, reproducible example is especially helpful.'],
    ],
    sources: [['Open Tree of Life: project, taxonomy and citations', 'https://tree.opentreeoflife.org/about/open-tree-of-life'], ['Wikipedia reuse and licensing', 'https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content'], ['GBIF species API documentation', 'https://techdocs.gbif.org/en/openapi/v1/species'], ['Report a problem or suggest an improvement', 'https://github.com/Tomer2006/infinitespecies/issues']],
  },
]
