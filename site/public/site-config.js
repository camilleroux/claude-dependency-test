// Single place to configure the public repo shown in install instructions.
export const REPO = 'camilleroux/claude-dependency-test';
export const INSTALL_COMMANDS = [
  `/plugin marketplace add ${REPO}`,
  '/plugin install claude-dependency-test@claude-dependency-test',
  '/claude-dependency-test:diagnose',
];

// The author's accounts ("Follow the doctor"). Keep in sync with share.follow in the plugin's
// config/scoring.json. Entries with an empty url are hidden.
export const FOLLOW = [
  { network: 'X', handle: '@CamilleRoux', url: 'https://x.com/CamilleRoux' },
  { network: 'Bluesky', handle: '@camilleroux.com', url: 'https://bsky.app/profile/camilleroux.com' },
  { network: 'LinkedIn', handle: 'Camille Roux', url: 'https://www.linkedin.com/in/camilleroux' },
  { network: 'Mastodon', handle: '@camilleroux@mastodon.social', url: 'https://mastodon.social/@camilleroux' },
  { network: 'GitHub', handle: 'camilleroux', url: 'https://github.com/camilleroux' },
].filter((f) => f.url);

// Who made this. Credited in shared posts ("via @…"), on every card and in the page metadata.
export const AUTHOR = {
  name: 'Camille Roux',
  url: 'https://www.camilleroux.com/?ref=claude-dependency-test',
  via: { x: 'CamilleRoux', bluesky: 'camilleroux.com', mastodon: 'camilleroux@mastodon.social' },
  cardCredit: '@CamilleRoux',
};
