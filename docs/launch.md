# Launch and search discovery

The app uses Next.js App Router, React 19, and Tailwind CSS 4. `npm run build`
renders the homepage and five reading pages into HTML. Guide content is readable
without JavaScript. The interactive map runs on the client and uses the taxonomy
backend. Public assets include the sitemap and robots rules.

## Publish this release

1. Deploy the Next.js frontend (`.next`) and the updated Node taxonomy
   backend together. The See what’s inside control uses `/api/tree/children/:id`.
2. Confirm the frontend's `TAXONOMY_API_URL` points at that backend. Netlify's
   existing configuration points at the Railway taxonomy service.
3. Check `/`, `/tree-of-life/`, `/explore/humans/`, `/explore/birds/`,
   `/explore/oaks/`, and `/about/` on the real domain. A made-up path must return
   HTTP 404. `/robots.txt` must allow `/_next/`.
4. Open a shared species link on a phone in a fresh session; it should open the
   destination without an onboarding modal or another Start click.

Deployment is a prerequisite for Google to see these local changes. No domain
verification, indexing request, deployment, or outreach is performed by the build.

## Let Google discover the pages

- Add `infinitespecies.com` as a Domain property in
  [Google Search Console](https://search.google.com/search-console/).
- Verify ownership using the DNS TXT record Google supplies. The value is unique
  to your account; do not invent a verification record.
- Submit `https://infinitespecies.com/sitemap.xml`.
- Inspect the homepage and `/tree-of-life/` with URL Inspection, run the live
  test, and request indexing after confirming the deployed page renders.
- Review Pages and Performance after Google has had time to crawl. Record
  impressions, clicks, queries, and which reading pages bring visitors.

Google controls crawling and indexing. A valid sitemap and crawlable content
help discovery but do not guarantee inclusion or rankings. Avoid treating a
`site:` search as a complete indexing report; use Search Console for diagnosis.

References: [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide),
[JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Get the first real users

Start with one audience: curious biology students and teachers. Ask five people
to open the human guide, find a second organism, and share its map link. Watch
where they hesitate; ask what surprised them and what they expected to happen.

Record a short screen capture showing one discovery from start to finish. Share
the relevant reading-page link with a biology club, an educator, or a nature
community that permits project sharing. Ask for feedback on a specific task
rather than asking people simply to visit. Respect each community's posting rules.

Track the first small cohort manually: invitations sent, people who tried it,
people who found an organism, and people who returned or shared. Search Console
measures search acquisition, not in-app engagement. Add a deliberately chosen
analytics service only if those manual observations stop being sufficient; this
release adds no tracker. Never publish fake testimonials or visitor counts.

## Next.js hosting

The frontend now uses Next.js App Router, React 19 and Tailwind CSS 4. Deploy
it with a Next.js-aware host (Netlify or Vercel), or run `npm start` after a build.
Keep the taxonomy service separate: it maintains a large in-memory index and
runs with `npm run backend`. Set `TAXONOMY_API_URL` to its `/api` endpoint.
`railway.json` starts the backend explicitly; Netlify publishes `.next`.

Guide routes are generated at build time. The homepage is server-rendered and
hydrates into the interactive explorer. The taxonomy canvas remains client-side.
