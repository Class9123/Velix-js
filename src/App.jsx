import { useState, useArray, useMemo, useEffect } from "velix";

const CHANNELS = [
  { id: "story", label: "Top Stories", hint: "Most linked stories" },
  { id: "ask_hn", label: "Ask HN", hint: "Questions from the community" },
  { id: "show_hn", label: "Show HN", hint: "Demos and launches" },
  { id: "job", label: "Jobs", hint: "Hiring posts" }
];

function normalizeHit(hit, channel) {
  return {
    id: hit.objectID,
    title: hit.title || hit.story_title || "Untitled",
    author: hit.author || "unknown",
    points: hit.points || 0,
    comments: hit.num_comments || 0,
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    createdAt: hit.created_at || "",
    channel
  };
}

function NewsCard({ article }) {
  return (
    <article class="card">
      <a class="card-title" href={article.url} target="_blank" rel="noreferrer">
        {article.title}
      </a>
      <p class="card-meta">
        by {article.author} | {article.points} points | {article.comments}{" "}
        comments
      </p>
      <div class="card-tags">
        <span class="pill">{article.channel}</span>
        <span class="pill">{article.id}</span>
      </div>
    </article>
  );
}

export default function App() {
  const [query, setQuery] = useState("react");
  const [draft, setDraft] = useState("react");
  const [channel, setChannel] = useState("story");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("-");
  const items = useArray([]);
  const searchRef = { current: null };

  let latestRequest = 0;

  const activeChannel = useMemo(() => {
    const found = CHANNELS.find(c => c.id === channel());
    return found ? found.label : channel();
  });

  const headerLine = useMemo(() => {
    return `${items().length} result(s) for "${query()}" in ${activeChannel()}`;
  });

  function fetchNews() {
    const q = query().trim();
    const ch = channel();
    if (!q) {
      items.setNew([]);
      setError("Type something in search before fetching news.");
      return;
    }

    const requestId = ++latestRequest;
    setLoading(true);
    setError("");

    const endpoint =
      "https://hn.algolia.com/api/v1/search?query=" +
      encodeURIComponent(q) +
      "&tags=" +
      encodeURIComponent(ch) +
      "&hitsPerPage=24";

    fetch(endpoint)
      .then(res => {
        if (!res.ok) {
          throw new Error(`News API failed with status ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (requestId !== latestRequest) return;
        const normalized = (data.hits || []).map(hit => normalizeHit(hit, ch));
        items.setNew(normalized);
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .catch(err => {
        if (requestId !== latestRequest) return;
        items.setNew([]);
        setError(err?.message || "Could not fetch latest news.");
      })
      .finally(() => {
        if (requestId !== latestRequest) return;
        setLoading(false);
      });
  }

  function runSearch() {
    const next = draft().trim();
    if (!next) {
      setError("Search box is empty. Give me at least one word.");
      return;
    }
    setQuery(next);
  }

  function resetFilters() {
    setDraft("react");
    setQuery("react");
    setChannel("story");
  }

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
  }, []);

  useEffect(() => {
    fetchNews();
  });

  return (
    <main class="dashboard">
      <section class="hero">
        <h1 class="hero-title">Velix News Desk</h1>
        <p class="hero-subtitle">
          HTML-first dashboard. Tiny runtime. Big headline energy.
        </p>
      </section>

      <section class="search-block">
        <div class="search-row">
          <input
            class="search-input"
            type="text"
            placeholder="Search news topics..."
            value={draft()}
            $ref={searchRef}
            onInput={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") runSearch();
            }}
          />
          <button class="btn primary" onClick={runSearch}>
            Search
          </button>
          <button class="btn ghost" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div class="channel-row">
          <button
            $for={c in CHANNELS}
            class={channel() === c.id ? "channel active" : "channel"}
            title={c.hint}
            onClick={() => setChannel(c.id)}
          >
            {c.label}
          </button>
        </div>

        <p class="status-line">{headerLine()}</p>
        <p class="status-line muted">Last updated: {lastUpdated()}</p>
      </section>

      <section class="feedback">
        <p class="loading" $when={loading()}>
          Loading latest headlines...
        </p>
        <p class="error" $if={error()}>
          {error()}
        </p>
        <p class="empty" $if={!loading() && !error() && items().length === 0}>
          No stories found. Try another keyword or channel.
        </p>
      </section>

      <section class="news-grid" $if={items().length > 0}>
        <div $for={article in items()}>
          <NewsCard article={article} />
        </div>
      </section>
    </main>
  );
}
